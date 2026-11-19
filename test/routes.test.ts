import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import plugin from '../server/index.ts'
import { article, diagnostic, profile } from './harness.ts'

describe('Diagnostic, from the reader', () => {
  it('refuses a report without an issue, or "Autre" without a note', async () => {
    const { post } = diagnostic()
    assert.equal((await post({ articleId: 'a1', issues: [] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['nope'] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['other'] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['cut'], note: 'x'.repeat(501) })).status, 400)
    assert.equal((await post({ articleId: 'zz', issues: ['cut'] })).status, 404)
  })

  it('keeps several reports on one article, its page fetched once', async () => {
    const { post, mine, state } = diagnostic()
    assert.equal(
      (await post({ articleId: 'a1', issues: ['cut', 'extra'], note: 'Le bloc « Lire aussi »' })).status,
      201
    )
    assert.equal((await post({ articleId: 'a1', issues: ['other'], note: 'La date est fausse' })).status, 201)
    assert.deepEqual(state.pages, ['a1'])
    assert.deepEqual(
      (await mine('a1')).map(report => report.issues),
      [['cut', 'extra'], ['other']]
    )
  })

  it('takes up to five PNG or JPG screenshots, and nothing else', async () => {
    const { post, capture, mine } = diagnostic()
    const { body } = await post({ articleId: 'a2', issues: ['images'] })
    const route = plugin.routes?.['POST /reports/:id/captures']
    assert.ok(route && typeof route !== 'function' && 'raw' in route && route.maxBody === 5 * 1024 * 1024)
    assert.equal((await capture(body?.id, new TextEncoder().encode('GIF89a'))).status, 415)
    assert.equal((await capture(999)).status, 404)
    for (let at = 0; at < 5; at += 1) assert.equal((await capture(body?.id)).status, 201)
    assert.equal((await capture(body?.id)).status, 409)
    assert.equal((await mine('a2'))[0]?.captures, 5)
  })

  it("keeps each profile's reports to itself", async () => {
    const { post, capture, mine, call, state } = diagnostic()
    const { body } = await post({ articleId: 'a1', issues: ['cut'] })
    for (const other of [profile(2), profile(1, 2)]) {
      state.who = other
      assert.deepEqual(await mine('a1'), [])
      assert.equal((await call('DELETE /reports/:id', { id: String(body?.id) })).status, 404)
      assert.equal((await capture(body?.id)).status, 404)
    }
    state.who = profile(1)
    assert.equal((await call('DELETE /reports/:id', { id: String(body?.id) })).status, 204)
    assert.equal((await call('DELETE /reports/:id', { id: String(body?.id) })).status, 404)
    assert.equal((await call('DELETE /reports/:id', { id: 'x' })).status, 404)
  })

  it('stops a profile at its reports of the day', async () => {
    const { post, call, state } = diagnostic()
    state.who = profile(1, 1, { serverAdmin: true })
    assert.equal((await call('PUT /limits', {}, { key: 'perDay', value: 2 })).status, 200)
    state.who = profile(3, 1, { kind: 'teen' })
    assert.equal((await post({ articleId: 'a1', issues: ['cut'] })).status, 201)
    assert.equal((await post({ articleId: 'a2', issues: ['cut'] })).status, 201)
    assert.deepEqual(await post({ articleId: 'a3', issues: ['cut'] }), { status: 429, body: { error: 'daily_limit' } })
    // Another profile has its own.
    state.who = profile(4)
    assert.equal((await post({ articleId: 'a3', issues: ['cut'] })).status, 201)
  })

  it('needs a profile', async () => {
    const { post, state } = diagnostic()
    state.who = profile(1, 1, { profileId: null })
    assert.equal((await post({ articleId: 'a1', issues: ['cut'] })).status, 403)
  })

  it("forgets a profile's reports when it is deleted, and a household's when it goes", async () => {
    const { post, summary, ctx, state } = diagnostic()
    await post({ articleId: 'a1', issues: ['cut'] })
    state.who = profile(2)
    await post({ articleId: 'a2', issues: ['cut'] })
    state.who = profile(5, 3)
    await post({ articleId: 'a3', issues: ['cut'] })
    await plugin.onProfileDeleted?.({ profileId: 1, householdId: 1 }, ctx)
    await plugin.onHouseholdRemoved?.({ householdId: 3 }, ctx)
    state.who = profile(9, 1, { serverAdmin: true })
    assert.deepEqual(
      (await summary()).rows.map(row => row.articleId),
      ['a2']
    )
  })

  it('notes what Hodi spots alone once per article, while the setting is on', async () => {
    const { ctx, state, summary } = diagnostic()
    const tell = async (read: Parameters<NonNullable<typeof plugin.onArticle>>[0]) => {
      await plugin.onArticle?.(read, ctx)
    }
    await tell(article('a3', { status: 'failed', text: null }))
    await tell(article('a3', { status: 'failed', text: null }))
    await tell(article('a4'))
    state.autoSignals = false
    await tell(article('a5', { status: 'failed', text: null }))

    state.who = profile(9, null, { serverAdmin: true })
    assert.deepEqual(
      (await summary()).rows.map(row => [row.articleId, row.issues, row.auto]),
      [['a3', ['blocked'], true]]
    )
  })
})
