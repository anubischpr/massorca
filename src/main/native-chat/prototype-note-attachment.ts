// Writes a note screenshot into a prototype request's notes/ folder on this host. The name and the bytes
// are checked before the disk is touched, and a link at the request or notes folder is refused.

import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { prototypeRequestFolder } from '../../shared/prototype-request-folder'
import { REQUEST_ID_PATTERN } from '../../shared/prototype-sets'
import {
  PROTOTYPE_ATTACHMENT_MAX_BYTES,
  PROTOTYPE_ATTACHMENT_NAME_PATTERN,
  type WriteAttachmentResult
} from '../../shared/rpc-contract/prototype-params'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'
import { readRequestManifest } from './prototype-request-disk'

const NOTES_FOLDER = 'notes'
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export type WritePrototypeAttachmentOptions = {
  stateDirectory: string
  sessionId: string
  requestId: string
  /** The base name of the file, without `.png`. */
  name: string
  pngBase64: string
}

/**
 * Writes a note screenshot to `prototypes/<requestId>/notes/<name>.png`. The request must already
 * exist on this host; a retry under the same name overwrites the file.
 */
export async function writePrototypeAttachment(
  options: WritePrototypeAttachmentOptions
): Promise<WriteAttachmentResult> {
  if (
    !PROTOTYPE_ATTACHMENT_NAME_PATTERN.test(options.name) ||
    !REQUEST_ID_PATTERN.test(options.requestId)
  ) {
    return { ok: false, error: 'invalid' }
  }
  const bytes = decodeStrictBase64(options.pngBase64)
  if (bytes === null) {
    return { ok: false, error: 'invalid' }
  }
  if (bytes.length > PROTOTYPE_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: 'too_large' }
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { ok: false, error: 'invalid' }
  }
  const requestFolder = join(
    nativeChatVisualsFolderFor(options.stateDirectory, options.sessionId),
    prototypeRequestFolder(options.requestId)
  )
  const manifest = await readRequestManifest(requestFolder)
  if (
    manifest === null ||
    manifest.requestId !== options.requestId ||
    manifest.sessionId !== options.sessionId
  ) {
    return { ok: false, error: 'unsupported' }
  }
  try {
    // Why the link checks: a symlink at the request or notes folder would send the write elsewhere.
    if (!(await lstat(requestFolder)).isDirectory()) {
      return { ok: false, error: 'unsupported' }
    }
    const notesFolder = join(requestFolder, NOTES_FOLDER)
    await mkdir(notesFolder, { recursive: true })
    const fileName = `${options.name}.png`
    const resolved = join(await realpath(notesFolder), fileName)
    if (!isStrictlyInside(await realpath(requestFolder), resolved)) {
      return { ok: false, error: 'unwritable' }
    }
    const target = join(notesFolder, fileName)
    if ((await lstat(target).catch(() => null))?.isSymbolicLink() === true) {
      return { ok: false, error: 'unwritable' }
    }
    await writeFile(target, bytes)
    return { ok: true, path: target }
  } catch {
    return { ok: false, error: 'unwritable' }
  }
}

// Why re-encode: Node skips stray base64 characters, so only text that encodes back to itself counts.
function decodeStrictBase64(text: string): Buffer | null {
  const bytes = Buffer.from(text, 'base64')
  return bytes.toString('base64') === text ? bytes : null
}

/** True for a path under `folder`: not `folder` itself, and not a path that leaves it. */
function isStrictlyInside(folder: string, file: string): boolean {
  const inside = relative(folder, file)
  return inside !== '' && inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)
}
