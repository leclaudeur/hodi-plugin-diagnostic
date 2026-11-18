import type { PluginContext } from '@hodi-app/plugin-sdk/server'

type Database = PluginContext['db']

// What keeps the pack from growing without end once every profile reports: the room it may take, how long a report
// stays, and how many reports a profile makes a day. The server's admin changes them in Serveur › Diagnostic.
export const LIMITS = {
  megabytes: { default: 500, min: 50, max: 5000 },
  days: { default: 90, min: 7, max: 365 },
  perDay: { default: 10, min: 1, max: 50 }
} as const

export type LimitKey = keyof typeof LIMITS
export type Limits = Record<LimitKey, number>

export const isLimitKey = (key: unknown): key is LimitKey => typeof key === 'string' && Object.hasOwn(LIMITS, key)

export const readLimits = (db: Database): Limits => {
  const rows = db.query('SELECT key, value FROM plugin_diagnostic_limits')
  const set = new Map(rows.map(row => [String(row.key), Number(row.value)]))
  return {
    megabytes: set.get('megabytes') ?? LIMITS.megabytes.default,
    days: set.get('days') ?? LIMITS.days.default,
    perDay: set.get('perDay') ?? LIMITS.perDay.default
  }
}

// false for a value out of its bounds, which the dialog never sends.
export const writeLimit = (db: Database, key: LimitKey, value: unknown) => {
  const { min, max } = LIMITS[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return false
  db.run('INSERT OR REPLACE INTO plugin_diagnostic_limits (key, value) VALUES (?, ?)', [key, value])
  return true
}

export const DAY = 24 * 60 * 60 * 1000

// The room in bytes, counted in thousands as Hodi shows sizes: 500 MB is 500,000,000 bytes.
export const roomBytes = (limits: Limits) => limits.megabytes * 1_000_000
