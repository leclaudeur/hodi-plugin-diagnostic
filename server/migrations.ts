// The plugin's own tables, one statement a step. Appended to, never edited once released. They keep the names they had
// in Hodi's database (plugin API 1), and IF NOT EXISTS: Hodi copies the tables of API 1 over before the first start, so
// the reports already made stay.
export const MIGRATIONS = [
  `
  -- What is wrong with an article: reported by the admin (auto 0), or spotted by Hodi as it read it (auto 1).
  CREATE TABLE IF NOT EXISTS plugin_diagnostic_reports (
    id INTEGER PRIMARY KEY,
    article_id TEXT NOT NULL,
    auto INTEGER NOT NULL,
    -- A JSON array of issues (issues.ts).
    issues TEXT NOT NULL,
    -- The admin's words: a precision, or what "Autre" is.
    note TEXT,
    -- The screenshot's type and size; its bytes are in plugin_diagnostic_captures.
    capture_type TEXT,
    capture_bytes INTEGER,
    created_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS plugin_diagnostic_reports_article ON plugin_diagnostic_reports (article_id)',
  `
  -- The article as Hodi had it when it was first reported: its reader text and its page on its site, for the pack.
  CREATE TABLE IF NOT EXISTS plugin_diagnostic_articles (
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
  )`,
  // The screenshots' bytes, in the plugin's own database since plugin API 2.
  `CREATE TABLE IF NOT EXISTS plugin_diagnostic_captures (
    report_id INTEGER PRIMARY KEY,
    data BLOB NOT NULL
  )`,
  // The screenshots of plugin API 1 were files Hodi does not carry over: their reports no longer say they have one.
  `UPDATE plugin_diagnostic_reports SET capture_type = NULL, capture_bytes = NULL
   WHERE capture_type IS NOT NULL AND id NOT IN (SELECT report_id FROM plugin_diagnostic_captures)`,
  // The household a report was made in: one plugin serves every household of the server. Null for what Hodi spotted
  // alone, which is about the reader and not any household, and which only the server's admin sees.
  'ALTER TABLE plugin_diagnostic_reports ADD COLUMN household_id INTEGER',
  // Before plugin API 2 there was one household per server: the admin's reports were all made in the first one.
  'UPDATE plugin_diagnostic_reports SET household_id = 1 WHERE auto = 0 AND household_id IS NULL',
  'CREATE INDEX IF NOT EXISTS plugin_diagnostic_reports_household ON plugin_diagnostic_reports (household_id)',
  // Several screenshots per report, each with its own type and size.
  `CREATE TABLE IF NOT EXISTS plugin_diagnostic_report_captures (
    id INTEGER PRIMARY KEY,
    report_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS plugin_diagnostic_report_captures_report ON plugin_diagnostic_report_captures (report_id)',
  `INSERT INTO plugin_diagnostic_report_captures (report_id, type, bytes, data, created_at)
   SELECT captures.report_id, reports.capture_type, reports.capture_bytes, captures.data, reports.created_at
   FROM plugin_diagnostic_captures captures JOIN plugin_diagnostic_reports reports ON reports.id = captures.report_id
   WHERE reports.capture_type IS NOT NULL`,
  'DROP TABLE IF EXISTS plugin_diagnostic_captures',
  'ALTER TABLE plugin_diagnostic_reports DROP COLUMN capture_type',
  'ALTER TABLE plugin_diagnostic_reports DROP COLUMN capture_bytes',
  // Every profile reports now, and sees only its own reports. Null for what Hodi spotted, and for the reports of the
  // admin made before.
  'ALTER TABLE plugin_diagnostic_reports ADD COLUMN profile_id INTEGER',
  'CREATE INDEX IF NOT EXISTS plugin_diagnostic_reports_profile ON plugin_diagnostic_reports (profile_id)',
  // The limits the server's admin sets in Serveur › Diagnostic; a missing key keeps its default (limits.ts).
  'CREATE TABLE IF NOT EXISTS plugin_diagnostic_limits (key TEXT PRIMARY KEY, value INTEGER NOT NULL)',
  // Hodi has no households any more: a profile's id names it on the whole server, and reports are its own.
  'DROP INDEX IF EXISTS plugin_diagnostic_reports_household',
  'ALTER TABLE plugin_diagnostic_reports DROP COLUMN household_id'
]
