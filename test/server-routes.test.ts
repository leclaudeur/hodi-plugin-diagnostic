import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import plugin from '../server/index.ts'
import { PNG, diagnostic, profile } from './harness.ts'

const ADMIN = profile(9, null, { serverAdmin: true })

// Two households report, one article twice, with screenshots.
const reported = async () => {
  const tools = diagnostic()
  const { post, capture, state } = tools
  const first = await post({ articleId: 'a1', issues: ['cut', 'extra'], note: 'Le bloc « Lire aussi »' })
  await capture(first.body?.id)
  await capture(first.body?.id)
  state.who = profile(7, 2)
  await post({ articleId: 'a1', issues: ['layout'] })
  await post({ articleId: 'a2', issues: ['images'] })
  state.who = ADMIN
  return tools
}

describe('Serveur › Diagnostic', () => {
  it("gathers every household's reports, by article", async () => {
    const { summary } = await reported()
    const { articles, rows, bytes, limits } = await summary()
    assert.equal(articles, 2)
    assert.deepEqual(rows.map(row => [row.articleId, row.issues, row.reports, row.captures]).sort(), [
      ['a1', ['cut', 'extra', 'layout'], 2, 2],
      ['a2', ['images'], 1, 0]
    ])
    assert.ok(bytes > 2 * PNG.length)
    assert.deepEqual(limits, { megabytes: 500, days: 90, perDay: 10 })
  })

  it('packs every article with its page, its text, its reports and their screenshots, never who said it', async () => {
    const { unzip } = await reported()
    const { filename, files } = await unzip('GET /pack')
    assert.match(filename, /^hodi-diagnostic-\d{4}-\d{2}-\d{2}$/)
    const names = [...files.keys()]
    assert.ok(names.includes('README.txt') && names.includes('index.json'))
    const a1 = names.find(name => name.endsWith('-a1/report.json'))
    assert.ok(a1)
    const folder = a1.slice(0, a1.lastIndexOf('/'))
    assert.equal(files.get(`${folder}/page.html`), '<html><body>Page a1</body></html>')
    assert.equal(files.get(`${folder}/extracted.html`), '<p>Le texte.</p>')
    const report = JSON.parse(files.get(a1) as string) as {
      reports: { id: number; by: string; captures: string[] }[]
    }
    const [first, second] = report.reports
    assert.deepEqual(first?.captures, [`capture-${first?.id}-1.png`, `capture-${first?.id}-2.png`])
    assert.deepEqual([...(files.get(`${folder}/capture-${first?.id}-2.png`) as Uint8Array)], [...PNG])
    assert.deepEqual([first?.by, second?.by, second?.captures], ['profile', 'profile', []])
    assert.doesNotMatch(files.get(a1) as string, /profile_?id|household/i)
  })

  it('changes a limit within its bounds', async () => {
    const { call } = diagnostic()
    assert.equal((await call('PUT /limits', {}, { key: 'days', value: 3 })).status, 400)
    assert.equal((await call('PUT /limits', {}, { key: 'nope', value: 30 })).status, 400)
    assert.deepEqual((await call('PUT /limits', {}, { key: 'days', value: 30 })).body, {
      limits: { megabytes: 500, days: 30, perDay: 10 }
    })
  })

  it('erases the oldest screenshots first once the pack is over its room', async () => {
    const { summary, call, ctx } = await reported()
    // A room smaller than what is kept: 50 MB, with a screenshot counted as 60.
    ctx.db.run('UPDATE plugin_diagnostic_report_captures SET bytes = ? WHERE id = 1', [60 * 1024 * 1024])
    await call('PUT /limits', {}, { key: 'megabytes', value: 50 })
    const { rows } = await summary()
    assert.equal(rows.find(row => row.articleId === 'a1')?.captures, 1)
    assert.equal(rows.length, 2)
  })

  it('erases the reports older than it keeps them, once a day', async () => {
    const { summary, ctx } = await reported()
    ctx.db.run("UPDATE plugin_diagnostic_reports SET created_at = 0 WHERE article_id = 'a2'")
    const expire = plugin.tasks?.expire
    assert.equal(expire?.every, 24 * 60)
    await expire?.run(ctx)
    assert.deepEqual(
      (await summary()).rows.map(row => row.articleId),
      ['a1']
    )
    assert.equal(ctx.db.get("SELECT 1 AS kept FROM plugin_diagnostic_articles WHERE article_id = 'a2'"), null)
  })

  it('empties the list once the pack is sent', async () => {
    const { call, summary, ctx } = await reported()
    assert.equal((await call('DELETE /reports')).status, 204)
    assert.deepEqual((await summary()).rows, [])
    assert.equal(ctx.db.get('SELECT COUNT(*) AS count FROM plugin_diagnostic_report_captures')?.count, 0)
    assert.equal((await summary()).bytes, 0)
  })
})
