import { MessageSquare } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  ChoiceField,
  Dialog,
  DialogActions,
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
  captures: File[]
}

// The report, then its screenshots: one that fails keeps the report, and only says so.
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
  for (const capture of draft.captures) {
    try {
      await ask(`/reports/${id}/captures`, {
        method: 'POST',
        headers: { 'Content-Type': capture.type },
        body: capture
      })
    } catch {
      onCaptureFailed()
      return
    }
  }
}

const FAILURES: Record<number, string> = { 404: 'dialog.gone', 429: 'dialog.dailyLimit' }

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

interface IssuesProps {
  issues: string[]
  disabled: boolean
  onChange: (issues: string[]) => void
}

// The problems as tags: the list grows without the dialog growing with it.
const IssueField = ({ issues, disabled, onChange }: IssuesProps) => {
  const { t } = usePluginTranslation()
  const choices = PICKED.map(issue => ({ id: issue, label: t(`issues.${issue}`) }))
  return (
    <ChoiceField
      choices={choices}
      selected={issues}
      onChange={onChange}
      label={t('dialog.issues')}
      placeholder={t('dialog.issuesPlaceholder')}
      morePlaceholder={t('dialog.issuesMore')}
      disabled={disabled}
    />
  )
}

interface ReportDialogProps {
  article: ReaderArticle
  open: boolean
  onClose: () => void
  // Sent: closes the list it was opened from too.
  onSent: () => void
}

// "Signaler un souci": the problems to pick, a note ("Autre" says itself there) and screenshots. Reported already,
// the article opens ReportsDialog first, and this form comes over it as a stacked card.
const ReportDialog = ({ article, open, onClose, onSent }: ReportDialogProps) => {
  const { t } = usePluginTranslation()
  const ask = useDiagnosticApi()
  const [issues, setIssues] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [captures, setCaptures] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setIssues([])
    setNote('')
    setCaptures([])
    setError(null)
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const saysOther = issues.includes('other')
  // "Autre" is said in the note, which it makes needed.
  const ready = issues.length > 0 && (!saysOther || note.trim().length > 0)

  const failure = (caught: unknown) => t((caught instanceof RequestError && FAILURES[caught.status]) || 'dialog.failed')

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await sendReport(ask, { articleId: article.id, issues, note, captures }, () =>
        showError(t('dialog.captureFailed'))
      )
      reportsChanged()
      showDone(t('dialog.done'))
      reset()
      onSent()
    } catch (caught) {
      setError(failure(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} title={t('dialog.title')} intro={<ReportIntro />}>
      {/* One block: the dialog's body scrolls it whole on a short screen, and squeezes none of its fields. */}
      <div className="diagnostic-form">
        <IssueField issues={issues} disabled={busy} onChange={setIssues} />
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
        <CaptureField files={captures} onChange={setCaptures} disabled={busy} />
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
