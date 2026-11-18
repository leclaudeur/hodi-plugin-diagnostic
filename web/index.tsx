import { Flag } from 'lucide-react'
import { definePlugin, usePluginTranslation } from 'hodi:sdk'
import { type Summary, useAsked } from './api.ts'
import DiagnosticPage from './DiagnosticPage.tsx'
import ReportAction from './ReportAction.tsx'
import './plugin.css'

// Under "Signalements" in the server's space: how many articles wait in the pack.
const SectionHint = () => {
  const { t } = usePluginTranslation()
  const { data } = useAsked<Summary>('/summary', 'server')
  if (!data) return null
  return <>{data.articles === 0 ? t('menu.none') : t('menu.count', { count: data.articles })}</>
}

// Every profile reports from the reader; the server's admin gathers the reports and the pack in its space.
definePlugin({
  readerAction: ReportAction,
  serverSections: [{ id: 'reports', label: 'sections.reports', icon: Flag, hint: SectionHint, page: DiagnosticPage }]
})
