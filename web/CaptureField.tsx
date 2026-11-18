import { ImageIcon, ImagePlus, X } from 'lucide-react'
import { type DragEvent, type RefObject, useRef, useState } from 'react'
import { RoundButton, StatusLine, usePluginTranslation } from 'hodi:sdk'
import { sizeText } from './format.ts'

// As the server checks them (server/captures.ts).
export const CAPTURE_MAX_BYTES = 5 * 1024 * 1024
export const CAPTURES_MAX = 5

const isImage = async (file: File) => {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, at) => bytes[at] === byte)
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  return png || jpg
}

// One screenshot taken: its name on one line, its size, and the way to take it out.
const ChosenCapture = ({ file, disabled, onRemove }: { file: File; disabled: boolean; onRemove: () => void }) => {
  const { t, language } = usePluginTranslation()
  return (
    <li className="diagnostic-capture-item">
      <ImageIcon size={16} aria-hidden="true" />
      <span className="diagnostic-capture-name">{file.name}</span>
      <span className="diagnostic-capture-size">{sizeText(file.size, language, t)}</span>
      <RoundButton
        icon={X}
        label={t('capture.remove', { name: file.name })}
        size={34}
        disabled={disabled}
        onClick={onRemove}
      />
    </li>
  )
}

// Takes the files it can, in order, and says why the last one left out was.
const useCaptureChoice = (
  files: File[],
  onChange: (files: File[]) => void,
  input: RefObject<HTMLInputElement | null>
) => {
  const { t } = usePluginTranslation()
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (chosen: File[]) => {
    if (!chosen.length) return
    setReading(true)
    setError(null)
    try {
      const taken: File[] = []
      let refused: string | null = null
      for (const file of chosen) {
        if (files.length + taken.length >= CAPTURES_MAX) refused = t('capture.errors.tooMany', { count: CAPTURES_MAX })
        else if (file.size > CAPTURE_MAX_BYTES) refused = t('capture.errors.tooBig', { name: file.name })
        else if (!(await isImage(file))) refused = t('capture.errors.notAnImage', { name: file.name })
        else taken.push(file)
      }
      if (taken.length) onChange([...files, ...taken])
      setError(refused)
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  return { choose, reading, error }
}

interface CaptureFieldProps {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

// The screenshots of a report: chosen or dropped, several at once, then listed under the zone (three in view, the
// rest by scrolling). A file that cannot be taken is said in a red line; the others still come in.
const CaptureField = ({ files, onChange, disabled = false }: CaptureFieldProps) => {
  const { t } = usePluginTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const { choose, reading, error } = useCaptureChoice(files, onChange, input)

  const full = files.length >= CAPTURES_MAX
  const busy = disabled || reading || full
  const drag = (event: DragEvent, entering: boolean) => {
    event.preventDefault()
    if (!busy) setOver(entering)
  }
  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    if (!busy) void choose([...event.dataTransfer.files])
  }
  const label = full ? 'capture.full' : reading ? 'capture.reading' : over ? 'capture.dropHere' : 'capture.choose'

  return (
    <div className="diagnostic-capture">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        hidden
        onChange={event => void choose([...(event.target.files ?? [])])}
      />
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
        <ImagePlus size={16} aria-hidden="true" />
        <span className="diagnostic-capture-label">{t(label, { count: CAPTURES_MAX })}</span>
        <span className="diagnostic-capture-hint">{t('capture.hint', { count: CAPTURES_MAX })}</span>
      </button>
      {error && <StatusLine tone="error">{error}</StatusLine>}
      {files.length > 0 && (
        <ul className="diagnostic-capture-list" aria-label={t('capture.list', { count: files.length })}>
          {files.map((file, index) => (
            <ChosenCapture
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              disabled={disabled}
              onRemove={() => onChange(files.filter((_, at) => at !== index))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default CaptureField
