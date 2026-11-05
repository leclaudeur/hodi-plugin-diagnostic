import type { ServerPlugin } from '@hodi-app/plugin-sdk/server'

// The server part: one table of its own and one route. Hodi serves the route at /api/plugins/my-plugin/hello, to
// the profiles the plugin is for, while it is on.
const plugin: ServerPlugin = {
  migrations: ['CREATE TABLE plugin_my_plugin_said (at TEXT NOT NULL)'],
  routes: (router, ctx) => {
    router.post('/hello', (_request, response) => {
      const { greeting, loud } = ctx.settings()
      ctx.db.prepare('INSERT INTO plugin_my_plugin_said (at) VALUES (?)').run(new Date().toISOString())
      const { count } = ctx.db.prepare('SELECT COUNT(*) AS count FROM plugin_my_plugin_said').get() as {
        count: number
      }
      const text = String(greeting)
      ctx.log(`said hello (${count})`)
      response.json({ text: loud ? text.toUpperCase() : text, count })
    })
  }
}

export default plugin
