import type { PluginArticle, PluginContext } from '@hodi-app/plugin-sdk/server'

type Database = PluginContext['db']

// The article as Hodi had it when it was first reported, its page on its site included, for the pack. One is shared by
// every report about it, whatever the household.
export const keepArticle = (
  db: Database,
  article: PluginArticle,
  page: { url: string; html: string } | null,
  now: number
) => {
  db.run(
    `INSERT OR REPLACE INTO plugin_diagnostic_articles
       (article_id, title, url, source_id, source_name, published_at, status, text_length, extracted_html,
        page_url, page_html, kept_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ]
  )
}

export const keptArticle = (db: Database, articleId: string) => {
  // Without the HTML itself, which can weigh hundreds of KB per article.
  const row = db.get(
    `SELECT article_id, title, url, source_id, source_name, published_at, status, text_length, page_url, kept_at,
            extracted_html IS NOT NULL AS has_text, page_html IS NOT NULL AS has_page
     FROM plugin_diagnostic_articles WHERE article_id = ?`,
    [articleId]
  )
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
    hasText: Number(row.has_text) === 1,
    pageUrl: row.page_url === null ? null : String(row.page_url),
    hasPage: Number(row.has_page) === 1,
    keptAt: Number(row.kept_at)
  } satisfies KeptArticle
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
  // Whether the reader's text and the page are kept: the pack's zip reads them from the database itself.
  hasText: boolean
  pageUrl: string | null
  hasPage: boolean
  keptAt: number
}

// Kept articles are shared by the households: one goes once no report of any household is about it.
export const dropUnreported = (db: Database) =>
  db.run(
    'DELETE FROM plugin_diagnostic_articles WHERE article_id NOT IN (SELECT article_id FROM plugin_diagnostic_reports)'
  )
