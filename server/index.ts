import type { PluginArticle, PluginContext, PluginRequest, ServerPlugin } from '@hodi-app/plugin-sdk/server'
import { CAPTURE_MAX_BYTES, captureType } from './captures.ts'
import { NOTE_MAX, PICKED, type Picked } from './issues.ts'
import { packEntries, packName } from './pack.ts'
import { spotted } from './signals.ts'
import { MIGRATIONS, type Store, createStore } from './store.ts'

// Hodi keeps at most this many articles it spotted alone: past it, only the admin's reports are added.
export const SPOTTED_MAX = 300

// Every route is the admin's alone (audience "admin" in plugin.json): Hodi checks it before they run.
// GET    /summary                  the page's numbers and rows
// GET    /articles/:id/reports     the admin's reports on an article, for the dialog
// POST   /reports                  a new report { articleId, issues, note? }
// PUT    /reports/:id/capture      its screenshot, the PNG or JPG file as the body
// DELETE /reports/:id              one report
// DELETE /reports                  all of them, once the pack is sent
// GET    /pack                     the zip to send, which Hodi builds

// One store per context: the context lives as long as the plugin's sandbox.
const stores = new WeakMap<PluginContext, Store>()
const storeOf = (ctx: PluginContext) => {
  let store = stores.get(ctx)
  if (!store) stores.set(ctx, (store = createStore(ctx.db)))
  return store
}

const text = (value: unknown, max: number) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.trim().length > max) return undefined
  return value.trim() || null
}

const reportId = (request: PluginRequest) => (/^\d+$/.test(request.params.id ?? '') ? Number(request.params.id) : null)

// Keeps the article as Hodi has it now, its page included, unless it is kept already.
const keep = async (ctx: PluginContext, store: Store, article: PluginArticle) => {
  if (store.kept(article.id)) return
  const page = await ctx.articles.page(article.id).catch(() => null)
  if (!store.kept(article.id)) store.keep(article, page, Date.now())
}

const plugin: ServerPlugin = {
  migrations: MIGRATIONS,

  routes: {
    'GET /summary': async (_request, ctx) => {
      const store = storeOf(ctx)
      const rows = store.list()
      return { body: { articles: rows.length, bytes: store.bytes(), rows } }
    },

    'GET /articles/:id/reports': async (request, ctx) => ({
      body: {
        reports: storeOf(ctx)
          .reportedOn(request.params.id ?? '')
          .map(({ id, issues, note, capture, createdAt }) => ({
            id,
            issues,
            note,
            capture: capture !== null,
            createdAt
          }))
      }
    }),

    'POST /reports': async (request, ctx) => {
      const store = storeOf(ctx)
      const body = (request.body ?? {}) as Record<string, unknown>
      const issues = Array.isArray(body.issues) ? [...new Set(body.issues)] : []
      const note = text(body.note, NOTE_MAX)
      const valid =
        typeof body.articleId === 'string' &&
        issues.length > 0 &&
        issues.every(issue => PICKED.includes(issue as Picked)) &&
        note !== undefined &&
        // "Autre" says what it is, in the note.
        (!issues.includes('other') || note !== null)
      if (!valid) return { status: 400, body: { error: 'invalid_report' } }
      const article = await ctx.articles.get(body.articleId as string)
      if (!article) return { status: 404, body: { error: 'not_found' } }
      await keep(ctx, store, article)
      const id = store.add({ articleId: article.id, auto: false, issues: issues as Picked[], note, now: Date.now() })
      ctx.log(`report ${id} on ${article.url}`)
      return { status: 201, body: { id } }
    },

    'PUT /reports/:id/capture': {
      raw: true,
      maxBody: CAPTURE_MAX_BYTES,
      handler: async (request, ctx) => {
        const store = storeOf(ctx)
        const id = reportId(request)
        const report = id === null ? null : store.get(id)
        if (!report || report.auto) return { status: 404, body: { error: 'not_found' } }
        const bytes = request.body as Uint8Array
        const type = captureType(bytes)
        if (!type) return { status: 415, body: { error: 'not_an_image' } }
        store.setCapture(report.id, type, bytes)
        return { status: 204 }
      }
    },

    'DELETE /reports/:id': async (request, ctx) => {
      const id = reportId(request)
      const removed = id === null ? null : storeOf(ctx).remove(id)
      if (!removed) return { status: 404, body: { error: 'not_found' } }
      return { status: 204 }
    },

    'DELETE /reports': async (_request, ctx) => {
      storeOf(ctx).clear()
      return { status: 204 }
    },

    'GET /pack': async (_request, ctx) => {
      const now = Date.now()
      return { zip: { filename: packName(now), entries: packEntries(storeOf(ctx), now) } }
    }
  },

  // What Hodi spots alone, as it reads an article for the first time. The page is fetched again after the hook
  // returns: Hodi's reader does not wait for it, and the sandbox gives that work the same time limit.
  onArticle: async (article, ctx) => {
    if (ctx.settings().autoSignals === false) return
    const issues = spotted(article)
    if (issues.length === 0) return
    const store = storeOf(ctx)
    if (store.spottedOn(article.id) || store.spottedCount() >= SPOTTED_MAX) return
    void keep(ctx, store, article)
      .then(() => {
        // Checked again: the same article may have been read twice while its page came.
        if (!store.spottedOn(article.id)) store.add({ articleId: article.id, auto: true, issues, now: Date.now() })
      })
      .catch(error => ctx.log(`could not keep ${article.url}: ${error instanceof Error ? error.message : error}`))
  }
}

export default plugin
