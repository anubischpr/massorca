import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { MAX_FILE_BYTES } from './bot-team-deliverables'

/** Bytes read to tell a binary file from a text one; a NUL byte among them makes it binary. */
const SNIFF_BYTES = 8192

/** A file a finished task may hand over as a copy: a regular file under the size limit, not binary. */
export function isCopyableFile(file: string): boolean {
  let fd: number | undefined
  try {
    fd = openSync(file, 'r')
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
      return false
    }
    const head = Buffer.alloc(Math.min(SNIFF_BYTES, stat.size))
    const read = readSync(fd, head, 0, head.length, 0)
    return !head.subarray(0, read).includes(0)
  } catch {
    return false
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
}
