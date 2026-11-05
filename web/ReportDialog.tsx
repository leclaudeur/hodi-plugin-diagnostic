import { MessageSquare, PenLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  FilterChip,
  type ReaderArticle,
  RoundButton,
  StatusLine,
  TextField,
  askToConfirm,
  showDone,
  showError,
  usePluginTranslation
} from 'hodi:sdk'
import { type Report, RequestError, reportsChanged, useDiagnosticApi } from './api.ts'
import CaptureField from './CaptureField.tsx'
import { issuesText } from './format.ts'

// What the admin can pick, as the server takes them (server/issues.ts).
const PICKED = ['cut', 'extra', 'images', 'layout', 'wrong', 'other'] as const
const OTHER_MAX = 200
const NOTE_MAX = 500

interface ReportDialogProps {
  article: ReaderArticle
  open: boolean
  // The admin's reports on this article already: listed on top, each can be taken back.
  reports: Report[]
  onClose: () => void
}

// "Signaler un souci": the problems to tick, "Autre" with its own words, a note and a screenshot. An article can be
// reported again for something else: what was reported before is listed above the form.
const ReportDialog = ({ article, open, reports, onClose }: ReportDialogProps) => {
  const { t } = usePluginTranslation()
  const ask = useDiagnosticApi()
  const [issues, setIssues] = useState<string[]>([])
  const [other, setOther] = useState('')
  const [note, setNote] = useState('')
  const [capture, setCapture] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setIssues([])
    setOther('')
    setNote('')
    setCapture(null)
    setError(null)
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const toggle = (issue: string) =>
    setIssues(current => (current.includes(issue) ? current.filter(entry => entry !== issue) : [...current, issue]))

  const saysOther = issues.includes('other')
  const ready = issues.length > 0 && (!saysOther || other.trim().length > 0)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const { id } = await ask<{ id: number }>('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          // In the order of the chips, whatever the order they were ticked in.
          issues: PICKED.filter(issue => issues.includes(issue)),
          ...(saysOther ? { other: other.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {})
        })
      })
      if (capture) {
        try {
          await ask(`/reports/${id}/capture`, {
            method: 'PUT',
            headers: { 'Content-Type': capture.type },
            body: capture
          })
        } catch {
          // The report is kept: only its screenshot is missing.
          showError(t('dialog.captureFailed'))
        }
      }
      reportsChanged()
      showDone(t('dialog.done'))
      reset()
      onClose()
    } catch (caught) {
      setError(caught instanceof RequestError && caught.status === 404 ? t('dialog.gone') : t('dialog.failed'))
    } finally {
      setBusy(false)
    }
  }

  const remove = (report: Report) =>
    askToConfirm({
      title: t('dialog.removeTitle'),
      message: t('dialog.removeMessage'),
      label: t('dialog.removeButton'),
      onConfirm: () =>
        void ask(`/reports/${report.id}`, { method: 'DELETE' }).then(reportsChanged, () =>
          showError(t('dialog.failed'))
        )
    })

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('dialog.title')}
      intro={
        reports.length > 0 ? (
          t('dialog.introAgain')
        ) : (
          <>
            {t('dialog.introStart')}
            <b>{t('dialog.introKept')}</b>
            {t('dialog.introEnd')}
          </>
        )
      }
    >
      {/* One block: the dialog's body scrolls it whole on a short screen, and squeezes none of its fields. */}
      <div className="diagnostic-form">
        {reports.length > 0 && (
          <div className="diagnostic-already">
            <h3 className="diagnostic-label">{t('dialog.already')}</h3>
            <ul className="diagnostic-card">
              {reports.map(report => (
                <li key={report.id} className="diagnostic-already-row">
                  <span className="diagnostic-already-text">
                    <span className="diagnostic-already-issues">{issuesText(report.issues, t, report.other)}</span>
                    {(report.note || report.capture) && (
                      <span className="diagnostic-already-note">
                        {[report.note, report.capture ? t('page.withCapture') : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <RoundButton
                    icon={Trash2}
                    label={t('dialog.remove')}
                    size={34}
                    variant="danger"
                    onClick={() => remove(report)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="diagnostic-chips" role="group" aria-label={t('dialog.issues')}>
          {PICKED.map(issue => (
            <FilterChip key={issue} selected={issues.includes(issue)} disabled={busy} onClick={() => toggle(issue)}>
              {t(`issues.${issue}`)}
            </FilterChip>
          ))}
        </div>
        {saysOther && (
          <TextField
            icon={PenLine}
            value={other}
            maxLength={OTHER_MAX}
            placeholder={t('dialog.otherPlaceholder')}
            aria-label={t('dialog.otherPlaceholder')}
            disabled={busy}
            autoFocus
            onChange={event => setOther(event.target.value)}
          />
        )}
        <TextField
          icon={MessageSquare}
          value={note}
          maxLength={NOTE_MAX}
          placeholder={t('dialog.notePlaceholder')}
          aria-label={t('dialog.notePlaceholder')}
          disabled={busy}
          onChange={event => setNote(event.target.value)}
        />
        <CaptureField file={capture} onChange={setCapture} disabled={busy} />
        {error && <StatusLine tone="error">{error}</StatusLine>}
      </div>
      <DialogActions>
        <Button onClick={close} disabled={busy}>
          {t('dialog.cancel')}
        </Button>
        <Button look="primary" busy={busy} disabled={!ready} onClick={() => void send()}>
          {t('dialog.send')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReportDialog
