import { Check, Flag } from 'lucide-react'
import { useState } from 'react'
import { type ReaderArticle, ReaderButton, usePluginTranslation } from 'hodi:sdk'
import { type Report, useAsked } from './api.ts'
import ReportDialog from './ReportDialog.tsx'
import ReportsDialog from './ReportsDialog.tsx'

// "Signaler" at the end of an article, beside "Lire l'original"; "Signalé · 2" once reported, and it opens the
// dialog again, to report something else or take a report back.
const ReportAction = ({ article }: { article: ReaderArticle }) => {
  const { t } = usePluginTranslation()
  // The list of what was reported, once there is some, and the form, alone or stacked over it.
  const [listOpen, setListOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const { data } = useAsked<{ reports: Report[] }>(`/articles/${encodeURIComponent(article.id)}/reports`)
  const reports = data?.reports ?? []

  return (
    <>
      <ReaderButton
        icon={reports.length > 0 ? <Check size={12} aria-hidden="true" /> : <Flag size={12} aria-hidden="true" />}
        done={reports.length > 0}
        onClick={() => (reports.length > 0 ? setListOpen(true) : setFormOpen(true))}
      >
        {reports.length === 0
          ? t('reader.report')
          : reports.length === 1
            ? t('reader.reported')
            : t('reader.reportedCount', { count: reports.length })}
      </ReaderButton>
      <ReportsDialog
        open={listOpen}
        reports={reports}
        onClose={() => {
          setFormOpen(false)
          setListOpen(false)
        }}
        onAdd={() => setFormOpen(true)}
      />
      <ReportDialog
        article={article}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSent={() => {
          setFormOpen(false)
          setListOpen(false)
        }}
      />
    </>
  )
}

export default ReportAction
