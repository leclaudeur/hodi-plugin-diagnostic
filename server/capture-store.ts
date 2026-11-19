import type { PluginContext } from '@hodi-app/plugin-sdk/server'
import { dropUnreported } from './article-store.ts'

type Database = PluginContext['db']

export type CaptureType = 'png' | 'jpg'

export interface Capture {
  id: number
  type: CaptureType
  bytes: number
}

// At most this many screenshots per report, as the dialog says.
export const CAPTURES_MAX = 5

// The screenshots of the given reports, by report, without their bytes.
export const capturesOf = (db: Database, reportIds: number[]) => {
  const byReport = new Map<number, Capture[]>()
  if (reportIds.length === 0) return byReport
  const rows = db.query(
    `SELECT id, report_id, type, bytes FROM plugin_diagnostic_report_captures
     WHERE report_id IN (${reportIds.map(() => '?').join(', ')}) ORDER BY id`,
    reportIds
  )
  for (const row of rows) {
    const reportId = Number(row.report_id)
    const capture = { id: Number(row.id), type: String(row.type) as CaptureType, bytes: Number(row.bytes) }
    byReport.set(reportId, [...(byReport.get(reportId) ?? []), capture])
  }
  return byReport
}

export const addCapture = (db: Database, reportId: number, type: CaptureType, bytes: Uint8Array, now: number) =>
  Number(
    db.run(
      'INSERT INTO plugin_diagnostic_report_captures (report_id, type, bytes, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [reportId, type, bytes.length, bytes, now]
    ).lastInsertRowid
  )

// Removes the reports a condition picks, with their screenshots and the articles nothing else is said about.
export const removeReports = (db: Database, where: string, params: (string | number)[]) => {
  db.run(
    `DELETE FROM plugin_diagnostic_report_captures
     WHERE report_id IN (SELECT id FROM plugin_diagnostic_reports WHERE ${where})`,
    params
  )
  const { changes } = db.run(`DELETE FROM plugin_diagnostic_reports WHERE ${where}`, params)
  dropUnreported(db)
  return changes
}

// Everything the pack holds before it is compressed, on the whole server: the pages, the texts and the screenshots.
export const storedBytes = (db: Database) => {
  const texts = db.get(
    `SELECT COALESCE(SUM(COALESCE(LENGTH(CAST(extracted_html AS BLOB)), 0) + COALESCE(LENGTH(CAST(page_html AS BLOB)), 0)), 0) AS bytes
     FROM plugin_diagnostic_articles`
  )
  const captures = db.get('SELECT COALESCE(SUM(bytes), 0) AS bytes FROM plugin_diagnostic_report_captures')
  return Number(texts?.bytes ?? 0) + Number(captures?.bytes ?? 0)
}

// Brings the pack back under its room: the oldest screenshots go first, as they weigh the most, then the oldest
// reports. Bounded, so a page bigger than the room alone never loops.
export const prune = (db: Database, maxBytes: number) => {
  for (let round = 0; round < 1000 && storedBytes(db) > maxBytes; round += 1) {
    const capture = db.get('SELECT id FROM plugin_diagnostic_report_captures ORDER BY created_at, id LIMIT 1')
    if (capture) {
      db.run('DELETE FROM plugin_diagnostic_report_captures WHERE id = ?', [Number(capture.id)])
      continue
    }
    const report = db.get('SELECT id FROM plugin_diagnostic_reports ORDER BY created_at, id LIMIT 1')
    if (!report) return
    removeReports(db, 'id = ?', [Number(report.id)])
  }
}
