import { ImagePlus, X } from 'lucide-react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { RoundButton, StatusLine, usePluginTranslation } from 'hodi:sdk'
import { sizeText } from './format.ts'

// As the server checks them (server/captures.ts).
export const CAPTURE_MAX_BYTES = 5 * 1024 * 1024

const isImage = async (file: File) => {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, at) => bytes[at] === byte)
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  return png || jpg
}

// The image read for a file: a preview of an earlier file is never shown for the next one.
const usePreview = (file: File) => {
  const [read, setRead] = useState<{ file: File; url: string } | null>(null)

  // Read as a data: address: Hodi's content policy shows no blob: image.
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setRead(typeof reader.result === 'string' ? { file, url: reader.result } : null)
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  return read && read.file === file ? read.url : null
}

// The screenshot taken: the image, its name and size, and the way to take it out.
const ChosenCapture = ({ file, disabled, onRemove }: { file: File; disabled: boolean; onRemove: () => void }) => {
  const { t, language } = usePluginTranslation()
  const preview = usePreview(file)
  return (
    <div className="diagnostic-capture-row diagnostic-capture-chosen">
      <span className="diagnostic-capture-tile">{preview && <img src={preview} alt="" />}</span>
      <span className="diagnostic-capture-text">
        <span className="diagnostic-capture-label">{t('capture.chosen')}</span>
        <span className="diagnostic-capture-hint">
          {file.name} · {sizeText(file.size, language, t)}
        </span>
      </span>
      <RoundButton icon={X} label={t('capture.remove')} size={34} disabled={disabled} onClick={onRemove} />
    </div>
  )
}

interface CaptureFieldProps {
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

// The screenshot of a report: chosen or dropped, like a plugin's file in Réglages › Plugins › Ajouter un plugin. The
// same states: lit while a file is over it, "Lecture…" while it is read, a red line when it cannot be taken. Taken,
// it shows the image, its name and size, and the way to take it out.
const CaptureField = ({ file, onChange, disabled = false }: CaptureFieldProps) => {
  const { t } = usePluginTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return
    setReading(true)
    setError(null)
    try {
      if (chosen.size > CAPTURE_MAX_BYTES) setError(t('capture.errors.tooBig'))
      else if (!(await isImage(chosen))) setError(t('capture.errors.notAnImage'))
      else onChange(chosen)
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  const busy = disabled || reading
  const drag = (event: DragEvent, entering: boolean) => {
    event.preventDefault()
    if (!busy) setOver(entering)
  }
  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    if (!busy) void choose(event.dataTransfer.files[0])
  }

  return (
    <div className="diagnostic-capture">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={event => void choose(event.target.files?.[0])}
      />
      {file ? (
        <ChosenCapture file={file} disabled={disabled} onRemove={() => onChange(null)} />
      ) : (
        <button
          type="button"
          className={`diagnostic-capture-row diagnostic-capture-drop ${over ? 'diagnostic-capture-over' : ''}`}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragEnter={event => drag(event, true)}
          onDragOver={event => drag(event, true)}
          onDragLeave={event => drag(event, false)}
          onDrop={drop}
        >
          <span className="diagnostic-capture-tile">
            <ImagePlus size={20} aria-hidden="true" />
          </span>
          <span className="diagnostic-capture-text">
            <span className="diagnostic-capture-label">
              {t(reading ? 'capture.reading' : over ? 'capture.dropHere' : 'capture.choose')}
            </span>
            <span className="diagnostic-capture-hint">{t('capture.hint')}</span>
          </span>
        </button>
      )}
      {error && <StatusLine tone="error">{error}</StatusLine>}
    </div>
  )
}

export default CaptureField
