import assert from 'node:assert/strict'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { before, describe, it } from 'node:test'
import type { PluginArticle, PluginContext, PluginRequest, PluginResponse, SqlValue } from '@hodi-app/plugin-sdk/server'
import plugin from '../server/index.ts'

const article = (id: string, change: Partial<PluginArticle> = {}): PluginArticle => ({
  id,
  title: `Article ${id}`,
  url: `https://alpha.example/${id}`,
  sourceId: 'alpha',
  sourceName: 'Alpha',
  publishedAt: '2026-11-05T10:00:00Z',
  status: 'ok',
  text: { title: `Article ${id}`, byline: null, contentHtml: '<p>Le texte.</p>', textLength: 4000 },
  ...change
})

// The plugin's database as the sandbox gives it, on node:sqlite: one statement at a time, plain values.
const pluginDatabase = (): PluginContext['db'] => {
  const db = new DatabaseSync(':memory:')
  const values = (params: SqlValue[] = []) =>
    params.map(value => (typeof value === 'boolean' ? Number(value) : value)) as SQLInputValue[]
  return {
    query: (sql, params) => db.prepare(sql).all(...values(params)) as Record<string, SqlValue>[],
    get: (sql, params) => (db.prepare(sql).get(...values(params)) as Record<string, SqlValue> | undefined) ?? null,
    run: (sql, params) => {
      const { changes, lastInsertRowid } = db.prepare(sql).run(...values(params))
      return { changes: Number(changes), lastInsertRowid: Number(lastInsertRowid) }
    }
  }
}

describe('Diagnostic', () => {
  let autoSignals = true
  const pages: string[] = []
  const ctx: PluginContext = {
    id: 'diagnostic',
    db: pluginDatabase(),
    settings: () => ({ autoSignals }),
    fetchText: async () => {
      throw new Error('no network in tests')
    },
    log: () => {},
    articles: {
      get: async id => (id.startsWith('a') ? article(id) : null),
      page: async id => {
        pages.push(id)
        return { url: `https://alpha.example/${id}`, html: `<html><body>Page ${id}</body></html>` }
      }
    }
  }

  // Calls a route as Hodi does once it matched it: method and path, the named parts, the JSON body.
  const call = async (route: string, params: Record<string, string> = {}, body: unknown = null) => {
    const handler = plugin.routes?.[route]
    assert.ok(handler, `no route ${route}`)
    const [method, path] = route.split(' ') as [PluginRequest['method'], string]
    const request: PluginRequest = {
      method,
      path,
      params,
      query: {},
      body,
      who: { profileId: 1, kind: 'adult', householdAdmin: true, serverAdmin: true }
    }
    const response: PluginResponse = await handler(request, ctx)
    return { status: response.status ?? 200, body: response.body as Record<string, unknown> | undefined }
  }
  const post = (body: unknown) => call('POST /reports', {}, body)
  const summary = async () =>
    (await call('GET /summary')).body as {
      articles: number
      bytes: number
      rows: { articleId: string; issues: string[]; auto: boolean; captures: number }[]
    }

  before(() => {
    for (const step of plugin.migrations ?? []) ctx.db.run(step)
  })

  it('runs its migrations once more without harm, as after Hodi copied its API 1 tables', () => {
    for (const step of plugin.migrations ?? []) ctx.db.run(step)
  })

  it('refuses a report without an issue, or "Autre" without a note', async () => {
    assert.equal((await post({ articleId: 'a1', issues: [] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['nope'] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['other'] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['cut'], note: 'x'.repeat(501) })).status, 400)
    assert.equal((await post({ articleId: 'zz', issues: ['cut'] })).status, 404)
  })

  it('keeps several reports on one article, its page fetched once', async () => {
    assert.equal(
      (await post({ articleId: 'a1', issues: ['cut', 'extra'], note: 'Le bloc « Lire aussi »' })).status,
      201
    )
    assert.equal((await post({ articleId: 'a1', issues: ['other'], note: 'La date est fausse' })).status, 201)
    assert.deepEqual(pages, ['a1'])

    const { body } = await call('GET /articles/:id/reports', { id: 'a1' })
    assert.deepEqual(
      (body?.reports as { issues: string[] }[]).map(report => report.issues),
      [['cut', 'extra'], ['other']]
    )
    const { articles, rows } = await summary()
    assert.equal(articles, 1)
    assert.deepEqual(rows[0]?.issues, ['cut', 'extra', 'other'])
  })

  it('removes one report, and the article once nothing is said about it', async () => {
    const { body } = await post({ articleId: 'a2', issues: ['images'] })
    const id = String(body?.id)
    assert.equal((await call('DELETE /reports/:id', { id })).status, 204)
    assert.equal((await call('DELETE /reports/:id', { id })).status, 404)
    assert.equal((await call('DELETE /reports/:id', { id: 'x' })).status, 404)
    assert.equal(
      (await summary()).rows.some(row => row.articleId === 'a2'),
      false
    )
  })

  it('notes what Hodi spots alone once per article, while the setting is on', async () => {
    const tell = async (read: PluginArticle) => {
      await plugin.onArticle?.(read, ctx)
      // What the hook left running: the page, then the row.
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    await tell(article('a3', { status: 'failed', text: null }))
    await tell(article('a3', { status: 'failed', text: null }))
    await tell(article('a4'))
    autoSignals = false
    await tell(article('a5', { status: 'failed', text: null }))
    autoSignals = true

    const rows = (await summary()).rows.filter(row => row.auto)
    assert.deepEqual(
      rows.map(row => [row.articleId, row.issues]),
      [['a3', ['blocked']]]
    )
  })

  it('empties the list once the pack is sent', async () => {
    assert.equal((await call('DELETE /reports')).status, 204)
    assert.deepEqual(await summary(), { articles: 0, bytes: 0, rows: [] })
  })
})
