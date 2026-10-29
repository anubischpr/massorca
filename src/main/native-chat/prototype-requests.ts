// Prototype requests on the execution host: a request's folder and manifest in the chat's visuals
// folder, the Gentle Shell design/ folder a request binds, and the bounded reads that serve them.
// Every path is resolved here from the host's own state; a caller names only a session and a file.

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NATIVE_CHAT_VISUAL_MAX_BYTES } from '../../shared/native-chat-visual-directive'
import {
  createPrototypeRequestId,
  isPlainPathSegment,
  parsePrototypeFileName,
  PROTOTYPE_MANIFEST_FILE_NAME,
  prototypeRequestFolder
} from '../../shared/prototype-request-folder'
import {
  parsePrototypeRequestManifest,
  REQUEST_ID_PATTERN,
  type PrototypeRequestManifest
} from '../../shared/prototype-sets'
import type {
  CreatePrototypeRequestParams,
  CreatePrototypeRequestResult,
  ReadPrototypeFileResult
} from '../../shared/rpc-contract/prototype-params'
import type { AgentSessionReadVisualResult } from '../../shared/rpc-contract/agent-session-visual-params'
import {
  gentleDesignSetFor,
  listGentleDesignSlugs,
  logPrototypeFailure,
  readRequestManifest
} from './prototype-request-disk'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'

export { listPrototypeSets, type ListPrototypeSetsOptions } from './prototype-request-listing'
export { writePrototypeAttachment } from './prototype-note-attachment'

const NOT_FOUND: ReadPrototypeFileResult = { ok: false, error: 'not_found' }

export type CreatePrototypeRequestOptions = {
  stateDirectory: string
  sessionId: string
  /** The chat's launch directory on this host; Gentle Shell's design/ folder is under it. */
  launchDirectory: string | undefined
  request: Pick<CreatePrototypeRequestParams, 'agent' | 'originalPrompt' | 'count'> &
    Partial<Pick<CreatePrototypeRequestParams, 'worktreeId' | 'chatTitle'>>
  now: Date
  random: () => number
}

/**
 * Makes `prototypes/<requestId>/` in the chat's visuals folder and writes its request.json. A
 * Gentle Shell request also records the design/ folders that already exist, so the one new folder
 * after the send can be bound to it.
 */
export async function createPrototypeRequest(
  options: CreatePrototypeRequestOptions
): Promise<CreatePrototypeRequestResult> {
  const { request, launchDirectory } = options
  const requestId = createPrototypeRequestId(options.now, options.random)
  const gentleDesignBaseline =
    request.agent === 'gentle-shell' && launchDirectory !== undefined
      ? await listGentleDesignSlugs(launchDirectory)
      : undefined
  const manifest = parsePrototypeRequestManifest({
    version: 1,
    requestId,
    agent: request.agent,
    sessionId: options.sessionId,
    originalPrompt: request.originalPrompt,
    count: request.count,
    createdAt: options.now.toISOString(),
    ...(request.worktreeId !== undefined ? { worktreeId: request.worktreeId } : {}),
    ...(request.chatTitle !== undefined ? { chatTitle: request.chatTitle } : {}),
    ...(launchDirectory !== undefined ? { sessionCwd: launchDirectory } : {}),
    ...(gentleDesignBaseline !== undefined ? { gentleDesignBaseline } : {})
  })
  if (manifest === null) {
    throw new Error('prototype request manifest does not match its schema')
  }
  const folder = requestFolderPath(options.stateDirectory, options.sessionId, requestId)
  try {
    await writeNewRequestFolder(folder, manifest)
  } catch (error) {
    logPrototypeFailure('creating a prototype request', error)
    return { ok: false, error: 'unwritable' }
  }
  return { ok: true, requestId, folderPath: folder }
}

/** Makes the request folder and writes its manifest; when the manifest fails, the folder made here is removed. */
async function writeNewRequestFolder(
  folder: string,
  manifest: PrototypeRequestManifest
): Promise<void> {
  // Why: mkdir reports the folder only when this call made it, so a folder that already existed is never removed.
  const created = await mkdir(folder, { recursive: true })
  try {
    // Why flag wx: a request folder is never overwritten, so a manifest is written once.
    await writeFile(join(folder, PROTOTYPE_MANIFEST_FILE_NAME), JSON.stringify(manifest, null, 2), {
      flag: 'wx'
    })
  } catch (error) {
    if (created !== undefined) {
      await rm(folder, { recursive: true, force: true }).catch((removeError: unknown) =>
        logPrototypeFailure('removing a partial prototype request', removeError)
      )
    }
    throw error
  }
}

export type ReadPrototypeSetFileOptions = {
  stateDirectory: string
  sessionId: string
  requestId: string
  fileName: string
}

/**
 * The HTML of one set file. The name must be a file of this request's own set: a
 * `prototypes/<requestId>/` direction file, or a Gentle Shell artboard of the design folder bound to
 * this request. Anything else is not found, whatever is on disk.
 */
export async function readPrototypeSetFile(
  options: ReadPrototypeSetFileOptions
): Promise<ReadPrototypeFileResult> {
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
    manifest.sessionId !== options.sessionId
  ) {
    return NOT_FOUND
  }
  const ownPrefix = `${prototypeRequestFolder(options.requestId)}/`
  if (options.fileName.startsWith(ownPrefix)) {
    const name = options.fileName.slice(ownPrefix.length)
    return parsePrototypeFileName(name) === null
      ? NOT_FOUND
      : toReadFileResult(
          await readNativeChatContainedTextFile(requestFolder, name, undefined, {
            maxBytes: NATIVE_CHAT_VISUAL_MAX_BYTES,
            isAllowedName: (file) => parsePrototypeFileName(file) !== null
          })
        )
  }
  return readGentleDesignFile(requestFolder, manifest, options.fileName)
}

async function readGentleDesignFile(
  requestFolder: string,
  manifest: PrototypeRequestManifest,
  fileName: string
): Promise<ReadPrototypeFileResult> {
  const set = await gentleDesignSetFor(requestFolder, manifest)
  const cwd = manifest.sessionCwd
  if (set === null || cwd === undefined) {
    return NOT_FOUND
  }
  const isSetFile = set.directions.some((direction) =>
    direction.versions.some((version) => version.fileName === fileName)
  )
  if (!isSetFile) {
    return NOT_FOUND
  }
  // Why the set check above: the slug is bound to this request, and only its artboards are served.
  // Why every segment: the folders are joined onto the session's cwd, so each must be one plain name.
  const segments = fileName.split('/')
  if (!segments.every(isPlainPathSegment)) {
    return NOT_FOUND
  }
  const file = segments.at(-1) ?? ''
  return toReadFileResult(
    await readNativeChatContainedTextFile(join(cwd, ...segments.slice(0, -1)), file, undefined, {
      maxBytes: NATIVE_CHAT_VISUAL_MAX_BYTES,
      isAllowedName: (name) => isPlainPathSegment(name)
    })
  )
}

function toReadFileResult(result: AgentSessionReadVisualResult): ReadPrototypeFileResult {
  if (!result.ok) {
    if (result.error === 'not_found' || result.error === 'session_not_found') {
      return NOT_FOUND
    }
    return { ok: false, error: result.error === 'too_large' ? 'too_large' : 'unreadable' }
  }
  return 'html' in result ? { ok: true, html: result.html } : { ok: false, error: 'unreadable' }
}

function requestFolderPath(stateDirectory: string, sessionId: string, requestId: string): string {
  return join(
    nativeChatVisualsFolderFor(stateDirectory, sessionId),
    prototypeRequestFolder(requestId)
  )
}
