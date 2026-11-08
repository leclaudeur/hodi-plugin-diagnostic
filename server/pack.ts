import type { Store } from './store.ts'

const README = `Hodi diagnostic pack

One folder per article reported in Réglages > Diagnostic, or spotted by Hodi alone:

  report.json      the article, what was said about it (issues, note) and when
  page.html        its page as its site served it when it was reported (missing when the site did not answer)
  extracted.html   the text Hodi's reader took from it (missing when it found none)
  capture-<n>.png  the screenshots added to the reports

Give the whole pack to whoever fixes the reader (server/news/extract.ts) or the sources (sources.yml).
`

// "hodi-diagnostic-2026-11-05", the day the pack is made: Hodi adds .zip.
export const packName = (now: number) => `hodi-diagnostic-${new Date(now).toISOString().slice(0, 10)}`

type Entry = { path: string; text: string } | { path: string; blob: { sql: string; params: (string | number)[] } }

// Everything the plugin kept, as the files of the zip Hodi builds. The pages and the screenshots are read by Hodi
// from the plugin's database as it writes the zip: they never pass through the plugin's memory.
export const packEntries = (store: Store, now: number): Entry[] => {
  const entries: Entry[] = [{ path: 'README.txt', text: README }]
  const reports = store.all()
  const index: unknown[] = []

  store.list().forEach((row, at) => {
    const article = store.article(row.articleId)
    if (!article) return
    // Folder names keep to what a zip from Hodi allows: letters, digits, dots, dashes and underscores.
    const folder = `${String(at + 1).padStart(3, '0')}-${row.articleId.replace(/[^A-Za-z0-9._-]/g, '_')}`
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
        note: report.note,
        capture: report.capture ? `capture-${report.id}.${report.capture.type}` : null,
        at: new Date(report.createdAt).toISOString()
      }))
    }
    entries.push({ path: `${folder}/report.json`, text: `${JSON.stringify(report, null, 2)}\n` })
    const column = (name: 'page_html' | 'extracted_html') => ({
      sql: `SELECT ${name} FROM plugin_diagnostic_articles WHERE article_id = ?`,
      params: [article.articleId]
    })
    if (article.hasPage) entries.push({ path: `${folder}/page.html`, blob: column('page_html') })
    if (article.hasText) entries.push({ path: `${folder}/extracted.html`, blob: column('extracted_html') })
    for (const { id, capture } of said) {
      if (!capture) continue
      entries.push({
        path: `${folder}/capture-${id}.${capture.type}`,
        blob: { sql: 'SELECT data FROM plugin_diagnostic_captures WHERE report_id = ?', params: [id] }
      })
    }
    index.push({ folder, title: article.title, source: article.sourceName, issues: row.issues })
  })

  entries.push({
    path: 'index.json',
    text: `${JSON.stringify({ madeAt: new Date(now).toISOString(), articles: index }, null, 2)}\n`
  })
  return entries
}
