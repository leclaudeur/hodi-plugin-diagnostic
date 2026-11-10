import assert from 'node:assert/strict'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { before, describe, it } from 'node:test'
import type { PluginArticle, PluginContext, PluginRequest, SqlValue } from '@hodi-app/plugin-sdk/server'
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
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

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

describe('Diagnostic, moved from plugin API 1', () => {
  it('keeps the copied reports, without the screenshots Hodi did not carry over', () => {
    const db = pluginDatabase()
    const [reports, index, articles, ...rest] = plugin.migrations ?? []
    // The tables as Hodi copies them from its own database, before the first start.
    for (const step of [reports, index, articles]) db.run(step!)
    db.run(
      "INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, capture_type, capture_bytes, created_at) VALUES ('a1', 0, '[\"images\"]', 'png', 11, 1)"
    )
    db.run(
      "INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, created_at) VALUES ('a2', 1, '[\"short\"]', 2)"
    )
    for (const step of plugin.migrations ?? []) db.run(step)
    assert.ok(rest.length > 0)
    assert.deepEqual(
      {
        ...db.get(
          'SELECT issues, capture_type, capture_bytes, household_id FROM plugin_diagnostic_reports WHERE auto = 0'
        )
      },
      {
        issues: '["images"]',
        capture_type: null,
        capture_bytes: null,
        // One household per server before: its first.
        household_id: 1
      }
    )
    // What Hodi spotted stays the server's.
    assert.equal(db.get('SELECT household_id FROM plugin_diagnostic_reports WHERE auto = 1')?.household_id, null)
  })
})

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

  // Calls a route as Hodi does once it matched it: method and path, the named parts, the JSON body or the bytes.
  const ADMIN: PluginRequest['who'] = {
    profileId: 1,
    householdId: 1,
    kind: 'adult',
    householdAdmin: true,
    serverAdmin: true
  }
  let who = ADMIN
  const answer = async (route: string, params: Record<string, string> = {}, body: unknown = null) => {
    const entry = plugin.routes?.[route]
    assert.ok(entry, `no route ${route}`)
    const handler = typeof entry === 'function' ? entry : entry.handler
    const [method, path] = route.split(' ') as [PluginRequest['method'], string]
    const request: PluginRequest = {
      method,
      path,
      params,
      query: {},
      body,
      who
    }
    return handler(request, ctx)
  }
  const call = async (route: string, params: Record<string, string> = {}, body: unknown = null) => {
    const response = await answer(route, params, body)
    assert.ok(!('zip' in response))
    return { status: response.status ?? 200, body: response.body as Record<string, unknown> | undefined }
  }
  // The files of a zip answer, read as Hodi does: text as given, a blob as the first column of its SELECT.
  const unzip = async (route: string) => {
    const response = await answer(route)
    assert.ok('zip' in response)
    const files = new Map<string, string | Uint8Array>()
    for (const entry of response.zip.entries) {
      if ('text' in entry) files.set(entry.path, entry.text)
      else {
        assert.match(entry.blob.sql, /^SELECT /)
        const row = ctx.db.get(entry.blob.sql, entry.blob.params)
        assert.ok(row, `nothing for ${entry.path}`)
        files.set(entry.path, Object.values(row)[0] as string | Uint8Array)
      }
    }
    return { filename: response.zip.filename, files }
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

  it('takes a PNG or JPG screenshot, and nothing else', async () => {
    const { body } = await post({ articleId: 'a2', issues: ['images'] })
    const id = String(body?.id)
    const route = plugin.routes?.['PUT /reports/:id/capture']
    assert.ok(route && typeof route !== 'function' && route.raw && route.maxBody === 5 * 1024 * 1024)
    assert.equal((await call('PUT /reports/:id/capture', { id }, new TextEncoder().encode('GIF89a'))).status, 415)
    assert.equal((await call('PUT /reports/:id/capture', { id: '999' }, PNG)).status, 404)
    assert.equal((await call('PUT /reports/:id/capture', { id }, PNG)).status, 204)
    assert.equal((await summary()).rows.find(row => row.articleId === 'a2')?.captures, 1)
  })

  it('packs every article with its page, its text, its reports and its captures', async () => {
    const { filename, files } = await unzip('GET /pack')
    assert.match(filename, /^hodi-diagnostic-\d{4}-\d{2}-\d{2}$/)
    const names = [...files.keys()]
    assert.ok(names.includes('README.txt') && names.includes('index.json'))
    const a2 = names.find(name => name.endsWith('-a2/report.json'))
    assert.ok(a2)
    const folder = a2.slice(0, a2.lastIndexOf('/'))
    assert.equal(files.get(`${folder}/page.html`), '<html><body>Page a2</body></html>')
    assert.equal(files.get(`${folder}/extracted.html`), '<p>Le texte.</p>')
    const capture = names.find(name => name.startsWith(`${folder}/capture-`))
    assert.ok(capture !== undefined && capture.endsWith('.png'))
    assert.deepEqual([...(files.get(capture) as Uint8Array)], [...PNG])
    const report = JSON.parse(files.get(a2) as string) as { reports: { by: string; issues: string[] }[] }
    assert.deepEqual(report.reports[0], { ...report.reports[0], by: 'admin', issues: ['images'] })
  })

  it('removes one report with its screenshot, and the article once nothing is said about it', async () => {
    const { body } = await call('GET /articles/:id/reports', { id: 'a2' })
    const id = String((body?.reports as { id: number }[])[0]?.id)
    assert.equal((await call('DELETE /reports/:id', { id })).status, 204)
    assert.equal(ctx.db.get('SELECT COUNT(*) AS count FROM plugin_diagnostic_captures')?.count, 0)
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

  it("keeps each household's reports apart, and what Hodi spotted for the server's admin", async () => {
    const mine = (await summary()).rows.map(row => row.articleId)
    assert.ok(mine.includes('a1') && mine.includes('a3'))
    const { body } = await call('GET /articles/:id/reports', { id: 'a1' })
    const theirs = String((body?.reports as { id: number }[])[0]?.id)

    // The admin of another household, who does not run the server.
    who = { profileId: 7, householdId: 2, kind: 'adult', householdAdmin: true, serverAdmin: false }
    try {
      assert.deepEqual(await summary(), { articles: 0, bytes: 0, rows: [] })
      assert.deepEqual((await call('GET /articles/:id/reports', { id: 'a1' })).body, { reports: [] })
      assert.equal((await call('DELETE /reports/:id', { id: theirs })).status, 404)
      assert.equal((await call('PUT /reports/:id/capture', { id: theirs }, PNG)).status, 404)
      assert.equal((await post({ articleId: 'a1', issues: ['layout'] })).status, 201)
      assert.deepEqual(
        (await summary()).rows.map(row => [row.articleId, row.issues]),
        [['a1', ['layout']]]
      )
      const { files } = await unzip('GET /pack')
      const reports = [...files.keys()].filter(name => name.endsWith('/report.json'))
      assert.equal(reports.length, 1)
      const report = JSON.parse(files.get(reports[0]!) as string) as { reports: { issues: string[] }[] }
      assert.deepEqual(
        report.reports.map(said => said.issues),
        [['layout']]
      )
      assert.equal((await call('DELETE /reports')).status, 204)
      assert.deepEqual((await summary()).rows, [])
    } finally {
      who = ADMIN
    }
    // Emptying theirs left this one's, and the article both reported.
    assert.deepEqual((await summary()).rows.map(row => row.articleId).sort(), [...mine].sort())

    who = { ...ADMIN, householdId: null }
    try {
      assert.equal((await call('GET /summary')).status, 403)
    } finally {
      who = ADMIN
    }
  })

  it('empties the list once the pack is sent', async () => {
    assert.equal((await call('DELETE /reports')).status, 204)
    assert.deepEqual(await summary(), { articles: 0, bytes: 0, rows: [] })
  })
})
