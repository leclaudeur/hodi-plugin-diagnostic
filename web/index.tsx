import { Flag } from 'lucide-react'
import { definePlugin, usePluginTranslation } from 'hodi:sdk'
import { type Summary, useAsked } from './api.ts'
import DiagnosticPage from './DiagnosticPage.tsx'
import ReportAction from './ReportAction.tsx'
import './plugin.css'

// Under "Diagnostic" in Réglages: how many articles wait in the pack.
const MenuHint = () => {
  const { t } = usePluginTranslation()
  const { data } = useAsked<Summary>('/summary')
  if (!data) return null
  return <>{data.articles === 0 ? t('menu.none') : t('menu.count', { count: data.articles })}</>
}

definePlugin({
  readerAction: ReportAction,
  page: DiagnosticPage,
  menuIcon: Flag,
  menuHint: MenuHint
})
