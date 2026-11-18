import type { PluginArticle, PluginContext } from '@hodi-app/plugin-sdk/server'
import { keepArticle, keptArticle } from './article-store.ts'
import { type Capture, capturesOf, removeReports, storedBytes } from './capture-store.ts'
import type { Issue } from './issues.ts'

type Database = PluginContext['db']

export { MIGRATIONS } from './migrations.ts'

// Who looks: a profile sees its own reports, the server's admin sees them all, with what Hodi spotted alone.
export type Scope = { profileId: number; householdId: number } | 'server'

export interface Report {
  id: number
  articleId: string
  auto: boolean
  issues: Issue[]
  note: string | null
  captures: Capture[]
  createdAt: number
}

// One row of Serveur › Diagnostic: an article and all that was said about it.
export interface ReportedArticle {
  articleId: string
  title: string
  sourceId: string
  sourceName: string
  // Every issue reported or spotted, each once, in the order they came.
  issues: Issue[]
  // Only spotted by Hodi, never reported.
  auto: boolean
  // How many times profiles reported it.
  reports: number
  captures: number
  // The last report.
  at: number
}

interface ReportRow {
  id: number
  article_id: string
  auto: number
  issues: string
  note: string | null
  created_at: number
}

const reportedArticles = (db: Database, all: Report[]): ReportedArticle[] => {
  const byArticle = new Map<string, Report[]>()
  for (const report of all) byArticle.set(report.articleId, [...(byArticle.get(report.articleId) ?? []), report])
  const rows: ReportedArticle[] = []
  for (const [articleId, said] of byArticle) {
    const article = db.get(
      'SELECT title, source_id, source_name FROM plugin_diagnostic_articles WHERE article_id = ?',
      [articleId]
    )
    // Kept before its first report is written, so always there.
    if (!article) continue
    rows.push({
      articleId,
      title: String(article.title),
      sourceId: String(article.source_id),
      sourceName: String(article.source_name),
      issues: [...new Set(said.flatMap(report => report.issues))],
      auto: said.every(report => report.auto),
      reports: said.filter(report => !report.auto).length,
      captures: said.reduce((count, report) => count + report.captures.length, 0),
      at: Math.max(...said.map(report => report.createdAt))
    })
  }
  return rows.sort((a, b) => b.at - a.at)
}

// The reports a scope sees, as a condition and its values; none without one (the hook only writes what Hodi spots).
const visibleTo = (scope: Scope | null) => {
  if (scope === 'server') return { sql: '1', params: [] as (string | number)[] }
  if (scope === null) return { sql: '0', params: [] as (string | number)[] }
  return { sql: '(household_id = ? AND profile_id = ?)', params: [scope.householdId, scope.profileId] }
}

export const createStore = (db: Database, scope: Scope | null) => {
  const visible = visibleTo(scope)
  const owner = scope === 'server' ? null : scope
  const reports = (where: string, ...values: (string | number)[]) => {
    const rows = db.query(
      `SELECT id, article_id, auto, issues, note, created_at FROM plugin_diagnostic_reports
       WHERE ${visible.sql} ${where ? `AND ${where}` : ''} ORDER BY created_at, id`,
      [...visible.params, ...values]
    ) as unknown as ReportRow[]
    const captures = capturesOf(
      db,
      rows.map(row => row.id)
    )
    return rows.map((row): Report => ({
      id: row.id,
      articleId: row.article_id,
      auto: row.auto === 1,
      issues: JSON.parse(row.issues) as Issue[],
      note: row.note,
      captures: captures.get(row.id) ?? [],
      createdAt: row.created_at
    }))
  }

  const kept = (articleId: string) =>
    db.get('SELECT 1 FROM plugin_diagnostic_articles WHERE article_id = ?', [articleId]) !== null

  return {
    kept,

    keep: (article: PluginArticle, page: { url: string; html: string } | null, now: number) =>
      keepArticle(db, article, page, now),

    article: (articleId: string) => keptArticle(db, articleId),

    add: (report: { articleId: string; auto: boolean; issues: readonly Issue[]; note?: string | null; now: number }) =>
      Number(
        db.run(
          `INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, note, created_at, household_id, profile_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            report.articleId,
            report.auto ? 1 : 0,
            JSON.stringify(report.issues),
            report.note ?? null,
            report.now,
            // What Hodi spots belongs to no household nor profile.
            report.auto ? null : (owner?.householdId ?? null),
            report.auto ? null : (owner?.profileId ?? null)
          ]
        ).lastInsertRowid
      ),

    get: (id: number) => reports('id = ?', id)[0] ?? null,

    // The profile's reports on an article, for the dialog: the spotted ones are not theirs to remove there.
    reportedOn: (articleId: string) => reports('article_id = ? AND auto = 0', articleId),

    // How many reports the profile made since a moment: a day's limit.
    madeSince: (since: number) =>
      Number(
        db.get(
          `SELECT COUNT(*) AS count FROM plugin_diagnostic_reports WHERE ${visible.sql} AND auto = 0 AND created_at > ?`,
          [...visible.params, since]
        )?.count ?? 0
      ),

    spottedOn: (articleId: string) =>
      db.get('SELECT 1 FROM plugin_diagnostic_reports WHERE article_id = ? AND auto = 1', [articleId]) !== null,

    spottedCount: () =>
      Number(db.get('SELECT COUNT(*) AS count FROM plugin_diagnostic_reports WHERE auto = 1')?.count ?? 0),

    // Removes a report, and the article it was about once nothing else is said about it.
    remove: (id: number) => {
      const report = reports('id = ?', id)[0]
      if (!report) return null
      removeReports(db, 'id = ?', [id])
      return report
    },

    all: () => reports(''),

    // The rows of Serveur › Diagnostic, the last reported first.
    list: (): ReportedArticle[] => reportedArticles(db, reports('')),

    bytes: () => storedBytes(db),

    // Empties what the scope sees.
    clear: () => removeReports(db, visible.sql, visible.params)
  }
}

export type Store = ReturnType<typeof createStore>
