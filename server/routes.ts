import type { PluginArticle, PluginContext, PluginRequest, PluginRoutes } from '@hodi-app/plugin-sdk/server'
import { CAPTURES_MAX, addCapture, prune } from './capture-store.ts'
import { CAPTURE_MAX_BYTES, captureType } from './captures.ts'
import { NOTE_MAX, PICKED, type Picked } from './issues.ts'
import { DAY, readLimits } from './limits.ts'
import { type Store, createStore } from './store.ts'

// What every profile does from the reader, on its own reports only:
// GET    /articles/:id/reports     its reports on an article, for the dialog
// POST   /reports                  a new report { articleId, issues, note? }
// POST   /reports/:id/captures     one of its screenshots, the PNG or JPG file as the body
// DELETE /reports/:id              one report

const storeOf = (ctx: PluginContext, { who }: PluginRequest) =>
  who.householdId === null || who.profileId === null
    ? null
    : createStore(ctx.db, { householdId: who.householdId, profileId: who.profileId })

const NO_PROFILE = { status: 403, body: { error: 'no_profile' } } as const

const text = (value: unknown, max: number) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.trim().length > max) return undefined
  return value.trim() || null
}

const reportId = (request: PluginRequest) => (/^\d+$/.test(request.params.id ?? '') ? Number(request.params.id) : null)

// Keeps the article as Hodi has it now, its page included, unless it is kept already.
export const keep = async (ctx: PluginContext, store: Store, article: PluginArticle) => {
  if (store.kept(article.id)) return
  const page = await ctx.articles.page(article.id).catch(() => null)
  if (!store.kept(article.id)) store.keep(article, page, Date.now())
}

const parseReport = (body: Record<string, unknown>) => {
  const issues = Array.isArray(body.issues) ? [...new Set(body.issues)] : []
  const note = text(body.note, NOTE_MAX)
  const valid =
    typeof body.articleId === 'string' &&
    issues.length > 0 &&
    issues.every(issue => PICKED.includes(issue as Picked)) &&
    note !== undefined &&
    // "Autre" says what it is, in the note.
    (!issues.includes('other') || note !== null)
  return valid ? { articleId: body.articleId as string, issues: issues as Picked[], note } : null
}

export const routes: PluginRoutes = {
  'GET /articles/:id/reports': async (request, ctx) => {
    const store = storeOf(ctx, request)
    if (!store) return NO_PROFILE
    const reports = store.reportedOn(request.params.id ?? '')
    return {
      body: {
        reports: reports.map(({ id, issues, note, captures, createdAt }) => ({
          id,
          issues,
          note,
          captures: captures.length,
          createdAt
        }))
      }
    }
  },

  'POST /reports': async (request, ctx) => {
    const store = storeOf(ctx, request)
    if (!store) return NO_PROFILE
    const report = parseReport((request.body ?? {}) as Record<string, unknown>)
    if (!report) return { status: 400, body: { error: 'invalid_report' } }
    const now = Date.now()
    if (store.madeSince(now - DAY) >= readLimits(ctx.db).perDay) return { status: 429, body: { error: 'daily_limit' } }
    const article = await ctx.articles.get(report.articleId)
    if (!article) return { status: 404, body: { error: 'not_found' } }
    await keep(ctx, store, article)
    const id = store.add({ ...report, articleId: article.id, auto: false, now })
    prune(ctx.db, readLimits(ctx.db).megabytes * 1024 * 1024)
    ctx.log(`report ${id} on ${article.url}`)
    return { status: 201, body: { id } }
  },

  'POST /reports/:id/captures': {
    raw: true,
    maxBody: CAPTURE_MAX_BYTES,
    handler: async (request, ctx) => {
      const store = storeOf(ctx, request)
      if (!store) return NO_PROFILE
      const id = reportId(request)
      const report = id === null ? null : store.get(id)
      if (!report || report.auto) return { status: 404, body: { error: 'not_found' } }
      if (report.captures.length >= CAPTURES_MAX) return { status: 409, body: { error: 'too_many' } }
      const bytes = request.body as Uint8Array
      const type = captureType(bytes)
      if (!type) return { status: 415, body: { error: 'not_an_image' } }
      addCapture(ctx.db, report.id, type, bytes, Date.now())
      prune(ctx.db, readLimits(ctx.db).megabytes * 1024 * 1024)
      return { status: 201 }
    }
  },

  'DELETE /reports/:id': async (request, ctx) => {
    const store = storeOf(ctx, request)
    if (!store) return NO_PROFILE
    const id = reportId(request)
    const removed = id === null ? null : store.remove(id)
    if (!removed) return { status: 404, body: { error: 'not_found' } }
    return { status: 204 }
  }
}
