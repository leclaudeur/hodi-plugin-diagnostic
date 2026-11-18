import { useCallback, useEffect, useState } from 'react'
import { usePluginApi, usePluginServerApi } from 'hodi:sdk'

// What the web part asks the plugin's server: a profile's own reports (server/routes.ts), and Serveur › Diagnostic
// (server/server-routes.ts). The event tells every part of it, the reader's button, the section and its entry, that
// the reports changed.

export interface ReportedArticle {
  articleId: string
  title: string
  sourceId: string
  sourceName: string
  issues: string[]
  auto: boolean
  reports: number
  captures: number
  at: number
}

export type LimitKey = 'megabytes' | 'days' | 'perDay'
export type Limits = Record<LimitKey, number>

export interface Summary {
  articles: number
  bytes: number
  rows: ReportedArticle[]
  limits: Limits
  bounds: Record<LimitKey, { min: number; max: number }>
}

export interface Report {
  id: number
  issues: string[]
  note: string | null
  captures: number
  createdAt: number
}

const CHANGED = 'diagnostic:changed'
export const reportsChanged = () => window.dispatchEvent(new Event(CHANGED))

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null
  ) {
    super(code ?? String(status))
  }
}

// Asks the profile's routes, or the server's with on: 'server'.
export const useDiagnosticApi = (on: 'profile' | 'server' = 'profile') => {
  const profileApi = usePluginApi()
  const serverApi = usePluginServerApi()
  const api = on === 'server' ? serverApi : profileApi
  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await api(path, init)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new RequestError(response.status, body?.error ?? null)
      }
      return (response.status === 204 ? null : await response.json()) as T
    },
    [api]
  )
}

// What the server answers to path, asked again whenever the reports change. null while it comes; failed when it
// did not answer.
export const useAsked = <T>(path: string, on: 'profile' | 'server' = 'profile') => {
  const ask = useDiagnosticApi(on)
  const [state, setState] = useState<{ data: T | null; failed: boolean }>({ data: null, failed: false })

  useEffect(() => {
    let live = true
    const load = () =>
      ask<T>(path).then(
        data => live && setState({ data, failed: false }),
        () => live && setState(previous => ({ ...previous, failed: true }))
      )
    void load()
    window.addEventListener(CHANGED, load)
    return () => {
      live = false
      window.removeEventListener(CHANGED, load)
    }
  }, [ask, path])

  return state
}
