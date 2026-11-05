import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, before, describe, it } from 'node:test'
import type { PluginArticle, PluginContext } from '@hodi-app/plugin-sdk/server'
import express from 'express'
import { unzipSync, strFromU8 } from 'fflate'
import plugin from '../server/index.ts'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

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

describe('Diagnostic', () => {
  let baseUrl = ''
  let close = () => {}
  const dataDir = mkdtempSync(path.join(tmpdir(), 'diagnostic-'))
  const db = new DatabaseSync(':memory:')
  let autoSignals = true
  const pages: string[] = []
  const ctx: PluginContext = {
    id: 'diagnostic',
    db,
    settings: () => ({ autoSignals }),
    fetchText: async () => {
      throw new Error('no network in tests')
    },
    log: () => {},
    dataDir,
    articles: {
      get: async id => (id.startsWith('a') ? article(id) : null),
      page: async id => {
        pages.push(id)
        return { url: `https://alpha.example/${id}`, html: `<html><body>Page ${id}</body></html>` }
      }
    }
  }

  const call = (url: string, init: RequestInit = {}) => fetch(`${baseUrl}${url}`, init)
  const post = (body: unknown) =>
    call('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const summary = async () =>
    (await (await call('/summary')).json()) as {
      articles: number
      bytes: number
      rows: { articleId: string; issues: string[]; auto: boolean; captures: number }[]
    }

  before(async () => {
    for (const step of plugin.migrations ?? []) db.exec(step)
    const app = express()
    app.use(express.json())
    const router = express.Router()
    plugin.routes?.(router, ctx)
    app.use(router)
    const server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    close = () => server.close()
  })

  after(() => close())

  it('refuses a report without an issue, or "Autre" without its words', async () => {
    assert.equal((await post({ articleId: 'a1', issues: [] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['nope'] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['other'] })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['cut'], other: 'pas pour toi' })).status, 400)
    assert.equal((await post({ articleId: 'a1', issues: ['cut'], note: 'x'.repeat(501) })).status, 400)
    assert.equal((await post({ articleId: 'zz', issues: ['cut'] })).status, 404)
  })

  it('keeps several reports on one article, its page fetched once', async () => {
    const first = await post({ articleId: 'a1', issues: ['cut', 'extra'], note: 'Le bloc « Lire aussi »' })
    assert.equal(first.status, 201)
    const second = await post({ articleId: 'a1', issues: ['other'], other: 'La date est fausse' })
    assert.equal(second.status, 201)
    assert.deepEqual(pages, ['a1'])

    const reports = (await (await call('/articles/a1/reports')).json()) as { reports: { issues: string[] }[] }
    assert.deepEqual(
      reports.reports.map(report => report.issues),
      [['cut', 'extra'], ['other']]
    )
    const { articles, rows } = await summary()
    assert.equal(articles, 1)
    assert.deepEqual(rows[0]?.issues, ['cut', 'extra', 'other'])
  })

  it('takes a PNG or JPG screenshot of 5 MB at most, and nothing else', async () => {
    const { id } = (await (await post({ articleId: 'a2', issues: ['images'] })).json()) as { id: number }
    const put = (body: Buffer) => call(`/reports/${id}/capture`, { method: 'PUT', body: new Uint8Array(body) })

    assert.equal((await put(Buffer.from('GIF89a'))).status, 415)
    assert.equal((await put(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413)
    assert.equal((await put(PNG)).status, 204)
    assert.deepEqual(readdirSync(path.join(dataDir, 'captures')), [`${id}.png`])
    assert.equal((await summary()).rows.find(row => row.articleId === 'a2')?.captures, 1)
  })

  it('packs every article with its page, its text, its reports and its captures', async () => {
    const response = await call('/pack')
    assert.equal(response.headers.get('content-type'), 'application/zip')
    assert.match(response.headers.get('content-disposition') ?? '', /hodi-diagnostic-\d{4}-\d{2}-\d{2}\.zip/)
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
    const names = Object.keys(files).sort()
    assert.ok(names.includes('README.txt') && names.includes('index.json'))
    const a2 = names.find(name => name.endsWith('-a2/report.json'))
    assert.ok(a2)
    const folder = path.dirname(a2)
    assert.ok(names.includes(`${folder}/page.html`))
    assert.ok(names.includes(`${folder}/extracted.html`))
    assert.ok(names.some(name => name.startsWith(`${folder}/capture-`) && name.endsWith('.png')))
    const report = JSON.parse(strFromU8(files[a2]!)) as { reports: { by: string; issues: string[] }[] }
    assert.deepEqual(report.reports[0], { ...report.reports[0], by: 'admin', issues: ['images'] })
  })

  it('removes one report, and the article once nothing is said about it', async () => {
    const { reports } = (await (await call('/articles/a2/reports')).json()) as { reports: { id: number }[] }
    const [report] = reports
    assert.ok(report)
    assert.equal((await call(`/reports/${report.id}`, { method: 'DELETE' })).status, 204)
    assert.equal((await call(`/reports/${report.id}`, { method: 'DELETE' })).status, 404)
    assert.deepEqual(readdirSync(path.join(dataDir, 'captures')), [])
    assert.equal(
      (await summary()).rows.some(row => row.articleId === 'a2'),
      false
    )
  })

  it('notes what Hodi spots alone once per article, while the setting is on', async () => {
    const tell = async (read: PluginArticle) => {
      plugin.onArticle?.(read, ctx)
      await new Promise(resolve => setTimeout(resolve, 20))
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

  it('empties the list once the pack is sent', async () => {
    assert.equal((await call('/reports', { method: 'DELETE' })).status, 204)
    assert.deepEqual(await summary(), { articles: 0, bytes: 0, rows: [] })
  })
})
