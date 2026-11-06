import type { PluginArticle, PluginContext, ServerPlugin } from '@hodi-app/plugin-sdk/server'
import type { Request, Response } from 'express'
import { CAPTURE_MAX_BYTES, captureFiles, captureType, readBody } from './captures.ts'
import { NOTE_MAX, PICKED, type Picked } from './issues.ts'
import { buildPack, packName } from './pack.ts'
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
// GET    /pack                     the zip to send

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

const reportId = (request: Request) => (/^\d+$/.test(String(request.params.id)) ? Number(request.params.id) : null)

// Keeps the article as Hodi has it now, its page included, unless it is kept already.
const keep = async (ctx: PluginContext, store: Store, article: PluginArticle) => {
  if (store.kept(article.id)) return
  const page = await ctx.articles.page(article.id).catch(() => null)
  if (!store.kept(article.id)) store.keep(article, page, Date.now())
}

const plugin: ServerPlugin = {
  migrations: MIGRATIONS,

  routes: (router, ctx) => {
    const store = storeOf(ctx)
    const captures = captureFiles(ctx.dataDir)

    router.get('/summary', (_request, response) => {
      const rows = store.list()
      response.json({ articles: rows.length, bytes: store.bytes(), rows })
    })

    router.get('/articles/:id/reports', (request, response) => {
      response.json({
        reports: store.reportedOn(String(request.params.id)).map(({ id, issues, note, capture, createdAt }) => ({
          id,
          issues,
          note,
          capture: capture !== null,
          createdAt
        }))
      })
    })

    router.post('/reports', async (request: Request, response: Response) => {
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
      if (!valid) {
        response.status(400).json({ error: 'invalid_report' })
        return
      }
      const article = await ctx.articles.get(body.articleId as string)
      if (!article) {
        response.status(404).json({ error: 'not_found' })
        return
      }
      await keep(ctx, store, article)
      const id = store.add({
        articleId: article.id,
        auto: false,
        issues: issues as Picked[],
        note,
        now: Date.now()
      })
      ctx.log(`report ${id} on ${article.url}`)
      response.status(201).json({ id })
    })

    router.put('/reports/:id/capture', async (request: Request, response: Response) => {
      const id = reportId(request)
      const report = id === null ? null : store.get(id)
      if (!report || report.auto) {
        response.status(404).json({ error: 'not_found' })
        return
      }
      const bytes = await readBody(request, CAPTURE_MAX_BYTES)
      if (!bytes) {
        response.status(413).json({ error: 'too_big' })
        return
      }
      const type = captureType(bytes)
      if (!type) {
        response.status(415).json({ error: 'not_an_image' })
        return
      }
      if (report.capture) captures.remove(report.id, report.capture.type)
      captures.write(report.id, type, bytes)
      store.setCapture(report.id, type, bytes.length)
      response.status(204).end()
    })

    router.delete('/reports/:id', (request, response) => {
      const id = reportId(request)
      const removed = id === null ? null : store.remove(id)
      if (!removed) {
        response.status(404).json({ error: 'not_found' })
        return
      }
      if (removed.capture) captures.remove(removed.id, removed.capture.type)
      response.status(204).end()
    })

    router.delete('/reports', (_request, response) => {
      store.clear()
      captures.clear()
      response.status(204).end()
    })

    router.get('/pack', (_request, response) => {
      const now = Date.now()
      response
        .set('Content-Type', 'application/zip')
        .set('Content-Disposition', `attachment; filename="${packName(now)}"`)
        .set('Cache-Control', 'no-store')
        .send(Buffer.from(buildPack(store, captures, now)))
    })
  },

  // What Hodi spots alone, as it reads an article for the first time. The page is fetched again in the background:
  // Hodi's reader does not wait for it.
  onArticle: (article, ctx) => {
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
