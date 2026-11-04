import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NATIVE_CHAT_VISUAL_MAX_BYTES } from '../../shared/native-chat-visual-directive'
import {
  parsePrototypeFileName,
  prototypeFileName,
  prototypeRequestFolder
} from '../../shared/prototype-request-folder'
import { REQUEST_ID_PATTERN, type PrototypeRequestManifest } from '../../shared/prototype-sets'
import type { RestorePrototypeVersionResult } from '../../shared/rpc-contract/prototype-params'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'
import { logPrototypeFailure, readRequestManifest } from './prototype-request-disk'

export type RestorePrototypeVersionOptions = {
  stateDirectory: string
  sessionId: string
  requestId: string
  letter: string
  version: number
  /** Whether this caller may change the request; a guest sees only the sets its chat lists. */
  canAct: (manifest: PrototypeRequestManifest) => boolean
}

const NOT_FOUND: RestorePrototypeVersionResult = { ok: false, error: 'not_found' }

/**
 * Copies one direction's earlier version into a new latest version, the way an agent iteration adds
 * one: history is never overwritten or removed. The source must be an existing version that is not
 * already the latest.
 */
export async function restorePrototypeVersion(
  options: RestorePrototypeVersionOptions
): Promise<RestorePrototypeVersionResult> {
  if (!REQUEST_ID_PATTERN.test(options.requestId)) {
    return NOT_FOUND
  }
  const requestFolder = join(
    nativeChatVisualsFolderFor(options.stateDirectory, options.sessionId),
    prototypeRequestFolder(options.requestId)
  )
  const manifest = await readRequestManifest(requestFolder)
  if (
    manifest === null ||
    manifest.requestId !== options.requestId ||
    manifest.sessionId !== options.sessionId ||
    !options.canAct(manifest)
  ) {
    return NOT_FOUND
  }
  const versions = await directionVersions(requestFolder, options.letter)
  const latest = Math.max(0, ...versions)
  if (!versions.includes(options.version) || options.version === latest) {
    return NOT_FOUND
  }
  const source = await readNativeChatContainedTextFile(
    requestFolder,
    prototypeFileName(options.letter, options.version),
    undefined,
    {
      maxBytes: NATIVE_CHAT_VISUAL_MAX_BYTES,
      isAllowedName: (file) => parsePrototypeFileName(file) !== null
    }
  )
  if (!source.ok || !('html' in source)) {
    return source.ok === false && source.error === 'not_found'
      ? NOT_FOUND
      : { ok: false, error: 'unwritable' }
  }
  const next = latest + 1
  const fileName = prototypeFileName(options.letter, next)
  try {
    // Why flag wx: an agent iteration may take the same number first, and a version is never overwritten.
    await writeFile(join(requestFolder, fileName), source.html, { flag: 'wx' })
  } catch (error) {
    if (isAlreadyExists(error)) {
      return { ok: false, error: 'conflict' }
    }
    logPrototypeFailure('restoring a prototype version', error)
    return { ok: false, error: 'unwritable' }
  }
  return { ok: true, fileName: `${prototypeRequestFolder(options.requestId)}/${fileName}`, version: next }
}

async function directionVersions(requestFolder: string, letter: string): Promise<number[]> {
  const names = await readdir(requestFolder).catch(() => [])
  return names.flatMap((name) => {
    const parsed = parsePrototypeFileName(name)
    return parsed !== null && parsed.letter === letter ? [parsed.version] : []
  })
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}
