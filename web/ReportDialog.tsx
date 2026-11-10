import { MessageSquare } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  FilterChip,
  type ReaderArticle,
  StatusLine,
  TextField,
  showDone,
  showError,
  usePluginTranslation
} from 'hodi:sdk'
import { RequestError, reportsChanged, useDiagnosticApi } from './api.ts'
import CaptureField from './CaptureField.tsx'

// What the admin can pick, as the server takes them (server/issues.ts).
const PICKED = ['cut', 'extra', 'images', 'layout', 'wrong', 'other'] as const
const NOTE_MAX = 500

interface Draft {
  articleId: string
  issues: string[]
  note: string
  capture: File | null
}

// The report, then its screenshot: a screenshot that fails keeps the report, and only says so.
const sendReport = async (ask: ReturnType<typeof useDiagnosticApi>, draft: Draft, onCaptureFailed: () => void) => {
  const { id } = await ask<{ id: number }>('/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId: draft.articleId,
      // In the order of the chips, whatever the order they were ticked in.
      issues: PICKED.filter(issue => draft.issues.includes(issue)),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {})
    })
  })
  if (!draft.capture) return
  try {
    await ask(`/reports/${id}/capture`, {
      method: 'PUT',
      headers: { 'Content-Type': draft.capture.type },
      body: draft.capture
    })
  } catch {
    onCaptureFailed()
  }
}

// What is kept with a report, in bold.
const ReportIntro = () => {
  const { t } = usePluginTranslation()
  return (
    <>
      {t('dialog.introStart')}
      <b>{t('dialog.introKept')}</b>
      {t('dialog.introEnd')}
    </>
  )
}

interface ChipsProps {
  issues: string[]
  disabled: boolean
  onToggle: (issue: string) => void
}

const IssueChips = ({ issues, disabled, onToggle }: ChipsProps) => {
  const { t } = usePluginTranslation()
  return (
    <div className="diagnostic-chips" role="group" aria-label={t('dialog.issues')}>
      {PICKED.map(issue => (
        <FilterChip key={issue} selected={issues.includes(issue)} disabled={disabled} onClick={() => onToggle(issue)}>
          {t(`issues.${issue}`)}
        </FilterChip>
      ))}
    </div>
  )
}

interface ReportDialogProps {
  article: ReaderArticle
  open: boolean
  onClose: () => void
  // Sent: closes the list it was opened from too.
  onSent: () => void
}

// "Signaler un souci": the problems to tick, a note ("Autre" says itself there) and a screenshot. Reported already,
// the article opens ReportsDialog first, and this form comes over it as a stacked card.
const ReportDialog = ({ article, open, onClose, onSent }: ReportDialogProps) => {
  const { t } = usePluginTranslation()
  const ask = useDiagnosticApi()
  const [issues, setIssues] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [capture, setCapture] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setIssues([])
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
  // "Autre" is said in the note, which it makes needed.
  const ready = issues.length > 0 && (!saysOther || note.trim().length > 0)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await sendReport(ask, { articleId: article.id, issues, note, capture }, () =>
        showError(t('dialog.captureFailed'))
      )
      reportsChanged()
      showDone(t('dialog.done'))
      reset()
      onSent()
    } catch (caught) {
      setError(caught instanceof RequestError && caught.status === 404 ? t('dialog.gone') : t('dialog.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} title={t('dialog.title')} intro={<ReportIntro />}>
      {/* One block: the dialog's body scrolls it whole on a short screen, and squeezes none of its fields. */}
      <div className="diagnostic-form">
        <IssueChips issues={issues} disabled={busy} onToggle={toggle} />
        {/* One field: a precision, or what "Autre" is once it is ticked. */}
        <TextField
          icon={MessageSquare}
          value={note}
          maxLength={NOTE_MAX}
          placeholder={t(saysOther ? 'dialog.otherPlaceholder' : 'dialog.notePlaceholder')}
          aria-label={t(saysOther ? 'dialog.otherPlaceholder' : 'dialog.notePlaceholder')}
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
