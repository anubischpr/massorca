import { statSync } from 'node:fs'
import { MAX_FILE_BYTES } from './bot-team-deliverables'

/** A file a finished task may hand over as a copy: a regular file under the size limit, binary or text. */
export function isCopyableFile(file: string): boolean {
  try {
    const stat = statSync(file)
    return stat.isFile() && stat.size <= MAX_FILE_BYTES
  } catch {
    return false
  }
}
