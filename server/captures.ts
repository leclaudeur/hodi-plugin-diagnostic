import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { CaptureType } from './store.ts'

// A screenshot is at most this big, as the dialog says.
export const CAPTURE_MAX_BYTES = 5 * 1024 * 1024

// What the file is, from its first bytes: the type the browser gives is not trusted.
export const captureType = (bytes: Uint8Array): CaptureType | null => {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, at) => bytes[at] === byte))
    return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  return null
}

// The request's body, read up to the limit: null when it is bigger.
export const readBody = async (stream: AsyncIterable<Buffer | string>, limit: number) => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > limit) return null
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

// The captures, in the plugin's own folder: captures/<report id>.<type>.
export const captureFiles = (dataDir: string) => {
  const dir = path.join(dataDir, 'captures')
  const file = (id: number, type: CaptureType) => path.join(dir, `${id}.${type}`)
  return {
    write: (id: number, type: CaptureType, bytes: Uint8Array) => {
      mkdirSync(dir, { recursive: true })
      writeFileSync(file(id, type), bytes)
    },
    read: (id: number, type: CaptureType) => {
      try {
        return readFileSync(file(id, type))
      } catch {
        return null
      }
    },
    remove: (id: number, type: CaptureType) => rmSync(file(id, type), { force: true }),
    clear: () => rmSync(dir, { recursive: true, force: true })
  }
}

export type CaptureFiles = ReturnType<typeof captureFiles>
