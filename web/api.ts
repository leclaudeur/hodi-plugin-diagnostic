import { useCallback, useEffect, useState } from 'react'
import { usePluginApi } from 'hodi:sdk'

// What the web part asks the plugin's server (server/index.ts), and the event that tells every part of it, the
// reader's button, the page and its entry in Réglages, that the reports changed.

export interface ReportedArticle {
  articleId: string
  title: string
  sourceId: string
  sourceName: string
  issues: string[]
  auto: boolean
  captures: number
  at: number
}

export interface Summary {
  articles: number
  bytes: number
  rows: ReportedArticle[]
}

export interface Report {
  id: number
  issues: string[]
  other: string | null
  note: string | null
  capture: boolean
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

export const useDiagnosticApi = () => {
  const api = usePluginApi()
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
export const useAsked = <T>(path: string) => {
  const ask = useDiagnosticApi()
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
