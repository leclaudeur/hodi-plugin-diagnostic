import { Flag, Image, Trash2 } from 'lucide-react'
import { Button, Dialog, DialogActions, RoundButton, askToConfirm, showError, usePluginTranslation } from 'hodi:sdk'
import { type Report, reportsChanged, useDiagnosticApi } from './api.ts'
import { issuesText } from './format.ts'

interface ReportsDialogProps {
  open: boolean
  reports: Report[]
  onClose: () => void
  // "Signaler autre chose": the form, stacked over this card.
  onAdd: () => void
}

// An article reported already: what was said about it, on its own card, each report can be taken back. The form to
// report something else comes over it, so the list never has to share the dialog with the form.
const ReportsDialog = ({ open, reports, onClose, onAdd }: ReportsDialogProps) => {
  const { t } = usePluginTranslation()
  const ask = useDiagnosticApi()

  const remove = (report: Report) =>
    askToConfirm({
      title: t('dialog.removeTitle'),
      message: t('dialog.removeMessage'),
      label: t('dialog.removeButton'),
      onConfirm: () =>
        void ask(`/reports/${report.id}`, { method: 'DELETE' }).then(
          () => {
            // The last one gone, nothing is left to list.
            if (reports.length === 1) onClose()
            reportsChanged()
          },
          () => showError(t('dialog.failed'))
        )
    })

  return (
    <Dialog open={open} onClose={onClose} title={t('list.title')} intro={t('list.intro')}>
      <ul className="diagnostic-reports">
        {reports.map(report => (
          <li key={report.id} className="diagnostic-report">
            <span className="diagnostic-report-text">
              <span className="diagnostic-report-issues">
                {issuesText(report.issues, t)}
                {report.capture && (
                  <Image size={14} className="diagnostic-capture-icon" aria-label={t('page.withCapture')} />
                )}
              </span>
              {report.note && <span className="diagnostic-report-note">{report.note}</span>}
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
      <DialogActions>
        <Button onClick={onClose}>{t('list.close')}</Button>
        <Button look="primary" icon={Flag} onClick={onAdd}>
          {t('list.add')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReportsDialog
