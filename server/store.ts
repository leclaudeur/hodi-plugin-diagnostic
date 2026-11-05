import type { PluginArticle, PluginContext } from '@hodi-app/plugin-sdk/server'
import type { Issue } from './issues.ts'

type Database = PluginContext['db']

// The plugin's own tables. Appended to, never edited once released.
export const MIGRATIONS = [
  `
  -- What is wrong with an article: reported by the admin (auto 0), or spotted by Hodi as it read it (auto 1).
  CREATE TABLE plugin_diagnostic_reports (
    id INTEGER PRIMARY KEY,
    article_id TEXT NOT NULL,
    auto INTEGER NOT NULL,
    -- A JSON array of issues (issues.ts).
    issues TEXT NOT NULL,
    -- What "Autre" says, and the admin's note.
    other TEXT,
    note TEXT,
    -- The screenshot, kept in the plugin's folder as captures/<id>.<png|jpg>.
    capture_type TEXT,
    capture_bytes INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX plugin_diagnostic_reports_article ON plugin_diagnostic_reports (article_id);

  -- The article as Hodi had it when it was first reported: its reader text and its page on its site, for the pack.
  CREATE TABLE plugin_diagnostic_articles (
    article_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    published_at TEXT,
    status TEXT NOT NULL,
    text_length INTEGER,
    extracted_html TEXT,
    page_url TEXT,
    page_html TEXT,
    kept_at INTEGER NOT NULL
  );
  `
]

export type CaptureType = 'png' | 'jpg'

export interface Report {
  id: number
  articleId: string
  auto: boolean
  issues: Issue[]
  other: string | null
  note: string | null
  capture: { type: CaptureType; bytes: number } | null
  createdAt: number
}

export interface KeptArticle {
  articleId: string
  title: string
  url: string
  sourceId: string
  sourceName: string
  publishedAt: string | null
  status: string
  textLength: number | null
  extractedHtml: string | null
  pageUrl: string | null
  pageHtml: string | null
  keptAt: number
}

// One row of Réglages › Diagnostic: an article and all that was said about it.
export interface ReportedArticle {
  articleId: string
  title: string
  sourceId: string
  sourceName: string
  // Every issue reported or spotted, each once, in the order they came.
  issues: Issue[]
  // Only spotted by Hodi, never reported.
  auto: boolean
  captures: number
  // The last report.
  at: number
}

interface ReportRow {
  id: number
  article_id: string
  auto: number
  issues: string
  other: string | null
  note: string | null
  capture_type: string | null
  capture_bytes: number | null
  created_at: number
}

const toReport = (row: ReportRow): Report => ({
  id: row.id,
  articleId: row.article_id,
  auto: row.auto === 1,
  issues: JSON.parse(row.issues) as Issue[],
  other: row.other,
  note: row.note,
  capture:
    row.capture_type && row.capture_bytes !== null
      ? { type: row.capture_type as CaptureType, bytes: row.capture_bytes }
      : null,
  createdAt: row.created_at
})

export const createStore = (db: Database) => {
  const reports = (where: string, ...values: (string | number)[]) =>
    (
      db
        .prepare(`SELECT * FROM plugin_diagnostic_reports ${where} ORDER BY created_at, id`)
        .all(...values) as unknown as ReportRow[]
    ).map(toReport)

  const kept = (articleId: string) =>
    db.prepare('SELECT 1 FROM plugin_diagnostic_articles WHERE article_id = ?').get(articleId) !== undefined

  return {
    kept,

    keep: (article: PluginArticle, page: { url: string; html: string } | null, now: number) => {
      db.prepare(
        `INSERT OR REPLACE INTO plugin_diagnostic_articles
           (article_id, title, url, source_id, source_name, published_at, status, text_length, extracted_html,
            page_url, page_html, kept_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        article.id,
        article.title,
        article.url,
        article.sourceId,
        article.sourceName,
        article.publishedAt,
        article.status,
        article.text?.textLength ?? null,
        article.text?.contentHtml ?? null,
        page?.url ?? null,
        page?.html ?? null,
        now
      )
    },

    article: (articleId: string) => {
      const row = db.prepare('SELECT * FROM plugin_diagnostic_articles WHERE article_id = ?').get(articleId) as
        Record<string, string | number | null> | undefined
      if (!row) return null
      return {
        articleId: String(row.article_id),
        title: String(row.title),
        url: String(row.url),
        sourceId: String(row.source_id),
        sourceName: String(row.source_name),
        publishedAt: row.published_at === null ? null : String(row.published_at),
        status: String(row.status),
        textLength: row.text_length === null ? null : Number(row.text_length),
        extractedHtml: row.extracted_html === null ? null : String(row.extracted_html),
        pageUrl: row.page_url === null ? null : String(row.page_url),
        pageHtml: row.page_html === null ? null : String(row.page_html),
        keptAt: Number(row.kept_at)
      } satisfies KeptArticle
    },

    add: (report: {
      articleId: string
      auto: boolean
      issues: readonly Issue[]
      other?: string | null
      note?: string | null
      now: number
    }) =>
      Number(
        db
          .prepare(
            `INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, other, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            report.articleId,
            report.auto ? 1 : 0,
            JSON.stringify(report.issues),
            report.other ?? null,
            report.note ?? null,
            report.now
          ).lastInsertRowid
      ),

    get: (id: number) => reports('WHERE id = ?', id)[0] ?? null,

    // The admin's reports on an article, for the dialog: the spotted ones are not theirs to remove there.
    reportedOn: (articleId: string) => reports('WHERE article_id = ? AND auto = 0', articleId),

    spottedOn: (articleId: string) =>
      db.prepare('SELECT 1 FROM plugin_diagnostic_reports WHERE article_id = ? AND auto = 1').get(articleId) !==
      undefined,

    spottedCount: () =>
      Number(
        (
          db.prepare('SELECT COUNT(*) AS count FROM plugin_diagnostic_reports WHERE auto = 1').get() as {
            count: number
          }
        ).count
      ),

    setCapture: (id: number, type: CaptureType, bytes: number) => {
      db.prepare('UPDATE plugin_diagnostic_reports SET capture_type = ?, capture_bytes = ? WHERE id = ?').run(
        type,
        bytes,
        id
      )
    },

    // Removes a report, and the article it was about once nothing else is said about it.
    remove: (id: number) => {
      const report = reports('WHERE id = ?', id)[0]
      if (!report) return null
      db.prepare('DELETE FROM plugin_diagnostic_reports WHERE id = ?').run(id)
      if (reports('WHERE article_id = ?', report.articleId).length === 0)
        db.prepare('DELETE FROM plugin_diagnostic_articles WHERE article_id = ?').run(report.articleId)
      return report
    },

    all: () => reports(''),

    // The rows of Réglages › Diagnostic, the last reported first.
    list: (): ReportedArticle[] => {
      const byArticle = new Map<string, Report[]>()
      for (const report of reports(''))
        byArticle.set(report.articleId, [...(byArticle.get(report.articleId) ?? []), report])
      const rows: ReportedArticle[] = []
      for (const [articleId, said] of byArticle) {
        const article = db
          .prepare('SELECT title, source_id, source_name FROM plugin_diagnostic_articles WHERE article_id = ?')
          .get(articleId) as { title: string; source_id: string; source_name: string } | undefined
        // Kept before its first report is written, so always there.
        if (!article) continue
        rows.push({
          articleId,
          title: article.title,
          sourceId: article.source_id,
          sourceName: article.source_name,
          issues: [...new Set(said.flatMap(report => report.issues))],
          auto: said.every(report => report.auto),
          captures: said.filter(report => report.capture).length,
          at: Math.max(...said.map(report => report.createdAt))
        })
      }
      return rows.sort((a, b) => b.at - a.at)
    },

    // What the pack holds, before it is compressed: the pages, the texts and the captures.
    bytes: () => {
      const texts = db
        .prepare(
          `SELECT COALESCE(SUM(COALESCE(LENGTH(CAST(extracted_html AS BLOB)), 0) + COALESCE(LENGTH(CAST(page_html AS BLOB)), 0)), 0) AS bytes
           FROM plugin_diagnostic_articles`
        )
        .get() as { bytes: number }
      const captures = db
        .prepare('SELECT COALESCE(SUM(capture_bytes), 0) AS bytes FROM plugin_diagnostic_reports')
        .get() as { bytes: number }
      return Number(texts.bytes) + Number(captures.bytes)
    },

    clear: () => {
      db.exec('DELETE FROM plugin_diagnostic_reports; DELETE FROM plugin_diagnostic_articles')
    }
  }
}

export type Store = ReturnType<typeof createStore>
