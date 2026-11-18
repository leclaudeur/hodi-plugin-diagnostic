import type { ServerPlugin } from '@hodi-app/plugin-sdk/server'
import { removeReports } from './capture-store.ts'
import { DAY, readLimits } from './limits.ts'
import { keep, routes } from './routes.ts'
import { serverRoutes } from './server-routes.ts'
import { spotted } from './signals.ts'
import { MIGRATIONS, createStore } from './store.ts'

// Hodi keeps at most this many articles it spotted alone: past it, only the profiles' reports are added.
export const SPOTTED_MAX = 300

const plugin: ServerPlugin = {
  migrations: MIGRATIONS,
  routes,
  serverRoutes,

  // Once a day, the reports older than the server's admin keeps them go, with their screenshots.
  tasks: {
    expire: {
      every: 24 * 60,
      run: async ctx => {
        removeReports(ctx.db, 'created_at < ?', [Date.now() - readLimits(ctx.db).days * DAY])
      }
    }
  },

  // A profile's reports leave with it, and a household's with it.
  onProfileDeleted: async ({ profileId, householdId }, ctx) => {
    removeReports(ctx.db, 'household_id = ? AND profile_id = ?', [householdId, profileId])
  },
  onHouseholdRemoved: async ({ householdId }, ctx) => {
    removeReports(ctx.db, 'household_id = ?', [householdId])
  },

  // What Hodi spots alone, as it reads an article for the first time. It belongs to no household. The page is fetched
  // again before the hook returns: Hodi refuses ctx.articles to work left running after it, and the reader does not
  // wait for the hook anyway.
  onArticle: async (article, ctx) => {
    if (ctx.settings().autoSignals === false) return
    const issues = spotted(article)
    if (issues.length === 0) return
    const store = createStore(ctx.db, null)
    if (store.spottedOn(article.id) || store.spottedCount() >= SPOTTED_MAX) return
    try {
      await keep(ctx, store, article)
      // Checked again: the same article may have been read twice while its page came.
      if (!store.spottedOn(article.id)) store.add({ articleId: article.id, auto: true, issues, now: Date.now() })
    } catch (error) {
      ctx.log(`could not keep ${article.url}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

export default plugin
