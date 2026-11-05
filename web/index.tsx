import { useState } from 'react'
import { Button, SettingRow, definePlugin, showError, usePluginApi, usePluginTranslation } from 'hodi:sdk'
import './plugin.css'

// The web part: a card under the plugin's options in Réglages, drawn with Hodi's own components.
const HelloCard = () => {
  const { t } = usePluginTranslation()
  const api = usePluginApi()
  const [said, setSaid] = useState<{ text: string; count: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const sayHello = async () => {
    setBusy(true)
    try {
      const response = await api('/hello', { method: 'POST' })
      if (!response.ok) throw new Error(String(response.status))
      setSaid((await response.json()) as { text: string; count: number })
    } catch {
      showError(t('failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-plugin-card">
      <SettingRow label={said ? said.text : t('title')} hint={said ? t('count', { count: said.count }) : t('hint')}>
        <Button compact busy={busy} onClick={() => void sayHello()}>
          {t('say')}
        </Button>
      </SettingRow>
    </div>
  )
}

definePlugin({ settingsPage: HelloCard })
