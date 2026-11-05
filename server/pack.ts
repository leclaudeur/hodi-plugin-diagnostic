import { type Zippable, strToU8, zipSync } from 'fflate'
import type { CaptureFiles } from './captures.ts'
import type { Store } from './store.ts'

const README = `Hodi diagnostic pack

One folder per article reported in Réglages > Diagnostic, or spotted by Hodi alone:

  report.json      the article, what was said about it (issues, "other", note) and when
  page.html        its page as its site served it when it was reported (missing when the site did not answer)
  extracted.html   the text Hodi's reader took from it (missing when it found none)
  capture-<n>.png  the screenshots added to the reports

Give the whole pack to whoever fixes the reader (server/news/extract.ts) or the sources (sources.yml).
`

// "2026-11-05", the day the pack is made, for its name.
export const packName = (now: number) => `hodi-diagnostic-${new Date(now).toISOString().slice(0, 10)}.zip`

// Everything the plugin kept, as a zip: the pack the admin downloads and sends.
export const buildPack = (store: Store, captures: CaptureFiles, now: number) => {
  const files: Zippable = { 'README.txt': strToU8(README) }
  const reports = store.all()
  const rows = store.list()
  const index: unknown[] = []

  rows.forEach((row, at) => {
    const article = store.article(row.articleId)
    if (!article) return
    const folder = `${String(at + 1).padStart(3, '0')}-${row.articleId}`
    const said = reports.filter(report => report.articleId === row.articleId)
    const report = {
      article: {
        id: article.articleId,
        title: article.title,
        url: article.url,
        source: { id: article.sourceId, name: article.sourceName },
        publishedAt: article.publishedAt,
        reader: { status: article.status, textLength: article.textLength },
        pageUrl: article.pageUrl,
        keptAt: new Date(article.keptAt).toISOString()
      },
      reports: said.map(report => ({
        id: report.id,
        by: report.auto ? 'hodi' : 'admin',
        issues: report.issues,
        other: report.other,
        note: report.note,
        capture: report.capture ? `capture-${report.id}.${report.capture.type}` : null,
        at: new Date(report.createdAt).toISOString()
      }))
    }
    files[`${folder}/report.json`] = strToU8(`${JSON.stringify(report, null, 2)}\n`)
    if (article.pageHtml !== null) files[`${folder}/page.html`] = strToU8(article.pageHtml)
    if (article.extractedHtml !== null) files[`${folder}/extracted.html`] = strToU8(article.extractedHtml)
    for (const { id, capture } of said) {
      const bytes = capture ? captures.read(id, capture.type) : null
      // Already compressed: stored as they are.
      if (bytes && capture) files[`${folder}/capture-${id}.${capture.type}`] = [bytes, { level: 0 }]
    }
    index.push({ folder, title: article.title, source: article.sourceName, issues: row.issues })
  })

  files['index.json'] = strToU8(
    `${JSON.stringify({ madeAt: new Date(now).toISOString(), articles: index }, null, 2)}\n`
  )
  return zipSync(files, { level: 6 })
}
