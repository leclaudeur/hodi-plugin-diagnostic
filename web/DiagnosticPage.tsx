import { ChevronDown, Download, Flag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  EmptyState,
  SectionPage,
  SettingRow,
  SettingsCard,
  SourceAvatar,
  StatusLine,
  askToConfirm,
  shortAgo,
  showDone,
  showError,
  usePluginTranslation
} from 'hodi:sdk'
import { type Summary, reportsChanged, useAsked, useDiagnosticApi } from './api.ts'
import { issuesText, sizeText } from './format.ts'

// Past three rows the others fold under a last one, which never hides a single row (as the teens' requests).
const FOLDED = 3
const PACK_HREF = '/api/plugins/diagnostic/pack'
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

// Réglages › Diagnostic, for the admin: the pack to download, what was reported or spotted, and emptying the list
// once the pack is sent.
const DiagnosticPage = ({ layout }: { layout: 'desktop' | 'phone' }) => {
  const { t, language } = usePluginTranslation()
  const ask = useDiagnosticApi()
  const { data, failed } = useAsked<Summary>('/summary')
  const [unfolded, setUnfolded] = useState(false)
  const [clearing, setClearing] = useState(false)

  const rows = data?.rows ?? []
  const folded = !unfolded && rows.length > FOLDED + 1
  const shown = folded ? rows.slice(0, FOLDED) : rows

  // The server answers with the zip as an attachment: the page stays where it is.
  const download = () => {
    const link = document.createElement('a')
    link.href = PACK_HREF
    link.download = ''
    link.click()
  }

  const clear = () =>
    askToConfirm({
      title: t('page.clearTitle'),
      message: t('page.clearMessage'),
      label: t('page.clearButton'),
      onConfirm: () => {
        setClearing(true)
        ask('/reports', { method: 'DELETE' })
          .then(
            () => {
              reportsChanged()
              showDone(t('page.cleared'))
            },
            () => showError(t('page.failed'))
          )
          .finally(() => setClearing(false))
      }
    })

  return (
    <SectionPage title={t('page.title')} intro={t('page.intro')} layout={layout}>
      {failed && !data && <StatusLine tone="error">{t('page.failed')}</StatusLine>}
      <SettingsCard label={t('page.pack')}>
        <SettingRow
          label={t('page.packTitle')}
          hint={
            data && data.articles > 0
              ? t('page.packHint', {
                  articles: t('page.articles', { count: data.articles }),
                  size: sizeText(data.bytes, language, t)
                })
              : t('page.packEmpty')
          }
        >
          <Button icon={Download} disabled={!data || data.articles === 0} onClick={download}>
            {t('page.download')}
          </Button>
        </SettingRow>
      </SettingsCard>

      <SettingsCard label={t('page.reported')}>
        {data && rows.length === 0 ? (
          <EmptyState icon={<Flag size={20} />} title={t('page.emptyTitle')} compact>
            {t('page.emptyText')}
          </EmptyState>
        ) : (
          <ul className="diagnostic-list">
            {shown.map(row => (
              <li key={row.articleId}>
                <a className="diagnostic-row" href={`#/article/${encodeURIComponent(row.articleId)}`}>
                  <span className="diagnostic-row-title">{row.title}</span>
                  <span className="diagnostic-row-issues">
                    {[
                      row.auto
                        ? `${t('page.auto')} · ${lowerFirst(issuesText(row.issues, t))}`
                        : issuesText(row.issues, t),
                      row.captures > 0 ? t('page.withCapture') : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="diagnostic-row-meta">
                    <SourceAvatar sourceId={row.sourceId} sourceName={row.sourceName} size={18} />
                    <span>{row.sourceName}</span>
                    <span className="diagnostic-row-time">· {shortAgo(new Date(row.at).toISOString())}</span>
                  </span>
                </a>
              </li>
            ))}
            {folded && (
              <li>
                <button type="button" className="diagnostic-row diagnostic-more" onClick={() => setUnfolded(true)}>
                  <span>{t('page.more', { count: rows.length - FOLDED })}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
              </li>
            )}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard label={t('page.after')}>
        <SettingRow label={t('page.clear')} hint={t('page.clearHint')}>
          <Button look="danger" icon={Trash2} busy={clearing} disabled={rows.length === 0} onClick={clear}>
            {t('page.clearButton')}
          </Button>
        </SettingRow>
      </SettingsCard>
    </SectionPage>
  )
}

export default DiagnosticPage
