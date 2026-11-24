import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import plugin from '../server/index.ts'
import { PNG, pluginDatabase } from './harness.ts'

const MIGRATIONS = plugin.migrations ?? []
// The steps of plugin API 2 before several screenshots: up to the captures' own table and the household's column.
const API_2 = MIGRATIONS.findIndex(step => step.includes('plugin_diagnostic_reports_household')) + 1

describe('Diagnostic, moved from plugin API 1', () => {
  it('keeps the copied reports, without the screenshots Hodi did not carry over', () => {
    const db = pluginDatabase()
    const [reports, index, articles] = MIGRATIONS
    // The tables as Hodi copies them from its own database, before the first start.
    for (const step of [reports, index, articles]) db.run(step!)
    db.run(
      "INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, capture_type, capture_bytes, created_at) VALUES ('a1', 0, '[\"images\"]', 'png', 11, 1)"
    )
    db.run(
      "INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, created_at) VALUES ('a2', 1, '[\"short\"]', 2)"
    )
    for (const step of MIGRATIONS) db.run(step)
    // The admin's report of before belongs to no profile: Serveur › Diagnostic still lists it.
    assert.deepEqual(
      { ...db.get('SELECT issues, profile_id FROM plugin_diagnostic_reports WHERE auto = 0') },
      { issues: '["images"]', profile_id: null }
    )
    assert.equal(db.get('SELECT COUNT(*) AS count FROM plugin_diagnostic_report_captures')?.count, 0)
    assert.equal(db.get('SELECT profile_id FROM plugin_diagnostic_reports WHERE auto = 1')?.profile_id, null)
  })
})

describe('Diagnostic, several screenshots per report', () => {
  it('moves the one screenshot a report had', () => {
    const db = pluginDatabase()
    for (const step of MIGRATIONS.slice(0, API_2)) db.run(step)
    db.run(
      "INSERT INTO plugin_diagnostic_reports (id, article_id, auto, issues, capture_type, capture_bytes, created_at, household_id) VALUES (4, 'a1', 0, '[\"images\"]', 'png', 11, 7, 1)"
    )
    db.run('INSERT INTO plugin_diagnostic_captures (report_id, data) VALUES (4, ?)', [PNG])
    for (const step of MIGRATIONS.slice(API_2)) db.run(step)
    const moved = db.get('SELECT report_id, type, bytes, data, created_at FROM plugin_diagnostic_report_captures')
    assert.deepEqual(
      { ...moved, data: [...(moved?.data as Uint8Array)] },
      {
        report_id: 4,
        type: 'png',
        bytes: 11,
        data: [...PNG],
        created_at: 7
      }
    )
    assert.equal(db.get("SELECT 1 AS old FROM sqlite_master WHERE name = 'plugin_diagnostic_captures'"), null)
  })
})

describe('Diagnostic, with no households', () => {
  it('keeps every report and drops the household it was made in', () => {
    const db = pluginDatabase()
    const before = MIGRATIONS.findIndex(step =>
      step.includes('DROP INDEX IF EXISTS plugin_diagnostic_reports_household')
    )
    for (const step of MIGRATIONS.slice(0, before)) db.run(step)
    db.run(
      "INSERT INTO plugin_diagnostic_reports (article_id, auto, issues, created_at, household_id, profile_id) VALUES ('a1', 0, '[\"cut\"]', 1, 2, 5)"
    )
    for (const step of MIGRATIONS.slice(before)) db.run(step)
    assert.deepEqual(
      { ...db.get('SELECT article_id, profile_id FROM plugin_diagnostic_reports') },
      {
        article_id: 'a1',
        profile_id: 5
      }
    )
    const columns = db.query('PRAGMA table_info(plugin_diagnostic_reports)').map(column => column.name)
    assert.equal(columns.includes('household_id'), false)
  })
})
