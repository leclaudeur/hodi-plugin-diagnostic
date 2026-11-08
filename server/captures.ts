import type { CaptureType } from './store.ts'

// A screenshot is at most this big, as the dialog says. Hodi refuses a bigger body before the plugin runs.
export const CAPTURE_MAX_BYTES = 5 * 1024 * 1024

// What the file is, from its first bytes: the type the browser gives is not trusted.
export const captureType = (bytes: Uint8Array): CaptureType | null => {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, at) => bytes[at] === byte))
    return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  return null
}
