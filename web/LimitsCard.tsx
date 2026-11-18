import { Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  SettingRow,
  SettingsCard,
  StatusLine,
  Stepper,
  usePluginTranslation
} from 'hodi:sdk'
import { type LimitKey, type Summary, reportsChanged, useDiagnosticApi } from './api.ts'

const KEYS: LimitKey[] = ['megabytes', 'days', 'perDay']
// How far one press of − or + goes, and the faster steps of a long press.
const STEPS: Record<LimitKey, { step: number; fast?: number[] }> = {
  megabytes: { step: 50, fast: [250, 500] },
  days: { step: 1, fast: [7, 30] },
  perDay: { step: 1, fast: [5] }
}

interface LimitDialogProps {
  open: boolean
  limit: LimitKey
  summary: Summary
  onClose: () => void
}

// One limit, with − and +, and what it does said in the dialog rather than in the row.
const LimitDialog = ({ open, limit, summary, onClose }: LimitDialogProps) => {
  const { t } = usePluginTranslation()
  const ask = useDiagnosticApi('server')
  const [value, setValue] = useState(summary.limits[limit])
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFailed(false)
    ask('/limits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: limit, value })
    })
      .then(() => {
        reportsChanged()
        onClose()
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  return (
    <Dialog open={open} onClose={onClose} title={t(`limits.${limit}.title`)} intro={t(`limits.${limit}.intro`)}>
      <form className="diagnostic-form" onSubmit={submit}>
        <Stepper
          label={t(`limits.${limit}.title`)}
          lessLabel={t('limits.less')}
          moreLabel={t('limits.more')}
          value={value}
          min={summary.bounds[limit].min}
          max={summary.bounds[limit].max}
          step={STEPS[limit].step}
          fastSteps={STEPS[limit].fast}
          onChange={setValue}
        >
          {t(`limits.${limit}.value`, { count: value })}
        </Stepper>
        {failed && <StatusLine tone="error">{t('page.failed')}</StatusLine>}
        <DialogActions>
          <Button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button type="submit" look="primary" busy={saving} disabled={value === summary.limits[limit]}>
            {t('limits.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

// Serveur › Diagnostic's limits: the room the pack may take, how long a report stays, how many a profile makes a day.
const LimitsCard = ({ summary }: { summary: Summary }) => {
  const { t } = usePluginTranslation()
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState<LimitKey>('megabytes')
  // A new dialog each time one opens, so it starts from the limit's value; the last one stays to close gently.
  const [round, setRound] = useState(0)
  const change = (key: LimitKey) => {
    setLimit(key)
    setRound(previous => previous + 1)
    setOpen(true)
  }

  return (
    <SettingsCard label={t('limits.label')}>
      {KEYS.map(key => (
        <SettingRow
          key={key}
          label={t(`limits.${key}.title`)}
          value={t(`limits.${key}.value`, { count: summary.limits[key] })}
          action={{ label: t('limits.change'), icon: Pencil, onClick: () => change(key) }}
        />
      ))}
      <LimitDialog key={round} open={open} limit={limit} summary={summary} onClose={() => setOpen(false)} />
    </SettingsCard>
  )
}

export default LimitsCard
