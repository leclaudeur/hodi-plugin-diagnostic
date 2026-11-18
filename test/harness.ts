import assert from 'node:assert/strict'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { PluginArticle, PluginContext, PluginRequest, SqlValue } from '@hodi-app/plugin-sdk/server'
import plugin from '../server/index.ts'

export const article = (id: string, change: Partial<PluginArticle> = {}): PluginArticle => ({
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

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

// The plugin's database as the sandbox gives it, on node:sqlite: one statement at a time, plain values.
export const pluginDatabase = (): PluginContext['db'] => {
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

// What Hodi gives a plugin and Diagnostic never uses: a call fails the test.
const unused = (): never => {
  throw new Error('not used by Diagnostic')
}
const notUsed = <T extends object>(): T => new Proxy({}, { get: () => unused }) as T

type Who = PluginRequest['who']

export const profile = (profileId: number, householdId: number | null = 1, change: Partial<Who> = {}): Who => ({
  accountId: profileId,
  profileId,
  householdId,
  kind: 'adult',
  householdAdmin: false,
  serverAdmin: false,
  ...change
})

// A plugin with its own database, its migrations run, and the routes called as Hodi does once it matched them.
export const diagnostic = () => {
  const state = { autoSignals: true, pages: [] as string[], who: profile(1) }
  const ctx: PluginContext = {
    id: 'diagnostic',
    db: pluginDatabase(),
    settings: () => ({ autoSignals: state.autoSignals }),
    fetchText: async () => {
      throw new Error('no network in tests')
    },
    log: () => {},
    http: unused,
    serverSettings: unused,
    mail: notUsed(),
    households: notUsed(),
    accounts: notUsed(),
    articles: {
      get: async id => (id.startsWith('a') ? article(id) : null),
      page: async id => {
        state.pages.push(id)
        return { url: `https://alpha.example/${id}`, html: `<html><body>Page ${id}</body></html>` }
      }
    }
  }
  for (const step of plugin.migrations ?? []) ctx.db.run(step)

  const answer = async (route: string, params: Record<string, string> = {}, body: unknown = null) => {
    const entry = plugin.routes?.[route] ?? plugin.serverRoutes?.[route]
    assert.ok(entry, `no route ${route}`)
    const handler = typeof entry === 'function' ? entry : entry.handler
    const [method, path] = route.split(' ') as [PluginRequest['method'], string]
    return handler({ method, path, params, query: {}, body, who: state.who }, ctx)
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
  const capture = (id: unknown, bytes: Uint8Array = PNG) =>
    call('POST /reports/:id/captures', { id: String(id) }, bytes)
  const summary = async () =>
    (await call('GET /summary')).body as {
      articles: number
      bytes: number
      limits: { megabytes: number; days: number; perDay: number }
      rows: { articleId: string; issues: string[]; auto: boolean; reports: number; captures: number }[]
    }
  const mine = async (articleId: string) =>
    ((await call('GET /articles/:id/reports', { id: articleId })).body?.reports ?? []) as {
      id: number
      issues: string[]
      captures: number
    }[]

  return { ctx, state, call, unzip, post, capture, summary, mine }
}
