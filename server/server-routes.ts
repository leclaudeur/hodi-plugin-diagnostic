import type { PluginRoutes } from '@hodi-app/plugin-sdk/server'
import { prune } from './capture-store.ts'
import { LIMITS, isLimitKey, readLimits, roomBytes, writeLimit } from './limits.ts'
import { packEntries, packName } from './pack.ts'
import { createStore } from './store.ts'

// Serveur › Diagnostic, the server's admin's alone (Hodi checks it before they run): every profile's reports, of
// every household, and what Hodi spotted.
// GET    /summary    the page's numbers, rows and limits
// PUT    /limits     one limit { key, value }
// DELETE /reports    all of them, once the pack is sent
// GET    /pack       the zip to send, which Hodi builds

export const serverRoutes: PluginRoutes = {
  'GET /summary': async (_request, ctx) => {
    const store = createStore(ctx.db, 'server')
    const rows = store.list()
    return { body: { articles: rows.length, bytes: store.bytes(), rows, limits: readLimits(ctx.db), bounds: LIMITS } }
  },

  'PUT /limits': async (request, ctx) => {
    const { key, value } = (request.body ?? {}) as Record<string, unknown>
    if (!isLimitKey(key) || !writeLimit(ctx.db, key, value)) return { status: 400, body: { error: 'invalid_limit' } }
    // A smaller room applies at once.
    if (key === 'megabytes') prune(ctx.db, roomBytes(readLimits(ctx.db)))
    return { body: { limits: readLimits(ctx.db) } }
  },

  'DELETE /reports': async (_request, ctx) => {
    createStore(ctx.db, 'server').clear()
    return { status: 204 }
  },

  'GET /pack': async (_request, ctx) => {
    const now = Date.now()
    return { zip: { filename: packName(now), entries: packEntries(createStore(ctx.db, 'server'), now) } }
  }
}
