// Prototype requests on the execution host: each request's folder and manifest in the chat's visuals
// folder, the Gentle Shell design/ folder a request can bind, and the bounded reads that serve them.
// Every path is resolved here from the host's own state; a caller names only a session and a file.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NATIVE_CHAT_VISUAL_MAX_BYTES } from '../../shared/native-chat-visual-directive'
import {
  createPrototypeRequestId,
  isPlainPathSegment,
  parsePrototypeFileName,
  PROTOTYPE_FOLDER,
  PROTOTYPE_MANIFEST_FILE_NAME,
  prototypeRequestFolder
} from '../../shared/prototype-request-folder'
import {
  buildPrototypeSet,
  parsePrototypeRequestManifest,
  REQUEST_ID_PATTERN,
  type PrototypeRequestManifest,
  type PrototypeSet
} from '../../shared/prototype-sets'
import type {
  CreatePrototypeRequestParams,
  CreatePrototypeRequestResult,
  ListPrototypeSetsResult,
  PrototypeListedDirection,
  PrototypeListedSet,
  ReadPrototypeFileResult
} from '../../shared/rpc-contract/prototype-params'
import type { AgentSessionReadVisualResult } from '../../shared/rpc-contract/agent-session-visual-params'
import {
  fileMtime,
  fileNamesIn,
  gentleDesignSetFor,
  listGentleDesignSlugs,
  readDirectoryEntries,
  readRequestManifest
} from './prototype-request-disk'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'
import {
  nativeChatVisualsFolderFor,
  nativeChatVisualsFolderName,
  nativeChatVisualsRootFor
} from './native-chat-visuals-folder'
import { directionNotesFor, withDirectionNotes } from './prototype-direction-notes'

export { writePrototypeAttachment } from './prototype-note-attachment'

// Why bounds: the scan runs on every Prototypes open; a chat with thousands of folders must not stall it.
const MAX_SESSION_FOLDERS_SCANNED = 500
const MAX_REQUEST_FOLDERS_SCANNED = 500
const MAX_REQUEST_FOLDERS_PER_SESSION = 100

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
  await mkdir(folder, { recursive: true })
  // Why flag wx: a request folder is never overwritten, so a manifest is written once.
  await writeFile(join(folder, PROTOTYPE_MANIFEST_FILE_NAME), JSON.stringify(manifest, null, 2), {
    flag: 'wx'
  })
  return { ok: true, requestId, folderPath: folder }
}

/** Every request on this host, newest first. Sets without any direction file are left out. */
export async function listPrototypeSets(options: {
  stateDirectory: string
  worktreeId?: string
}): Promise<ListPrototypeSetsResult> {
  const root = nativeChatVisualsRootFor(options.stateDirectory)
  const sets: PrototypeListedSet[] = []
  for (const candidate of await requestFolderCandidates(root)) {
    const listed = await listedSetFor(candidate, options.worktreeId)
    if (listed !== null) {
      sets.push(listed)
    }
  }
  sets.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return { sets }
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
  return readGentleDesignFile(manifest, options.fileName)
}

async function readGentleDesignFile(
  manifest: PrototypeRequestManifest,
  fileName: string
): Promise<ReadPrototypeFileResult> {
  const set = await gentleDesignSetFor(manifest)
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
  const segments = fileName.split('/')
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

type RequestFolderCandidate = {
  visualsFolderName: string
  visualsFolder: string
  requestName: string
}

async function requestFolderCandidates(root: string): Promise<RequestFolderCandidate[]> {
  const candidates: RequestFolderCandidate[] = []
  const sessionFolders = (await readDirectoryEntries(root))
    .filter((entry) => entry.isDirectory())
    .slice(0, MAX_SESSION_FOLDERS_SCANNED)
  for (const sessionFolder of sessionFolders) {
    const visualsFolder = join(root, sessionFolder.name)
    // Why per-chat newest-first cap: one busy chat must not starve the others out of the list.
    const requests = (await readDirectoryEntries(join(visualsFolder, PROTOTYPE_FOLDER)))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(newestRequestNameFirst)
      .slice(0, MAX_REQUEST_FOLDERS_PER_SESSION)
    for (const requestName of requests) {
      candidates.push({ visualsFolderName: sessionFolder.name, visualsFolder, requestName })
    }
  }
  return candidates
    .sort((left, right) => newestRequestNameFirst(left.requestName, right.requestName))
    .slice(0, MAX_REQUEST_FOLDERS_SCANNED)
}

// Request ids start with a UTC timestamp, so a descending name sort is newest first.
function newestRequestNameFirst(left: string, right: string): number {
  return right.localeCompare(left)
}

async function listedSetFor(
  candidate: RequestFolderCandidate,
  worktreeId: string | undefined
): Promise<PrototypeListedSet | null> {
  const requestFolder = join(candidate.visualsFolder, prototypeRequestFolder(candidate.requestName))
  const manifest = await readRequestManifest(requestFolder)
  // Why: the folder is keyed by the session's hash, so a manifest that names another session is misplaced.
  if (
    manifest === null ||
    manifest.requestId !== candidate.requestName ||
    nativeChatVisualsFolderName(manifest.sessionId) !== candidate.visualsFolderName
  ) {
    return null
  }
  if (worktreeId !== undefined && manifest.worktreeId !== worktreeId) {
    return null
  }
  const gentle = await gentleDesignSetFor(manifest)
  const gentleDirections =
    gentle !== null && manifest.sessionCwd !== undefined
      ? await directionsWithMtime(gentle, manifest.sessionCwd)
      : []
  const directions =
    gentleDirections.length > 0
      ? gentleDirections
      : withDirectionNotes(
          await directionsWithMtime(
            buildPrototypeSet(manifest, await fileNamesIn(requestFolder)),
            candidate.visualsFolder
          ),
          manifest.agent === 'gentle-shell' ? [] : await directionNotesFor(requestFolder)
        )
  if (directions.length === 0) {
    return null
  }
  return {
    requestId: manifest.requestId,
    sessionId: manifest.sessionId,
    agent: manifest.agent,
    worktreeId: manifest.worktreeId ?? null,
    chatTitle: manifest.chatTitle ?? null,
    originalPrompt: manifest.originalPrompt,
    createdAt: manifest.createdAt,
    count: manifest.count,
    folderPath: requestFolder,
    directions
  }
}

/** Each direction's versions that exist on disk, with their last write time. */
async function directionsWithMtime(
  set: PrototypeSet,
  root: string
): Promise<PrototypeListedDirection[]> {
  const directions: PrototypeListedDirection[] = []
  for (const direction of set.directions) {
    const versions: PrototypeListedDirection['versions'] = []
    for (const version of direction.versions) {
      const mtime = await fileMtime(join(root, ...version.fileName.split('/')))
      if (mtime !== null) {
        versions.push({ version: version.version, fileName: version.fileName, mtime })
      }
    }
    if (versions.length > 0) {
      directions.push({ letter: direction.letter, versions })
    }
  }
  return directions
}

function requestFolderPath(stateDirectory: string, sessionId: string, requestId: string): string {
  return join(
    nativeChatVisualsFolderFor(stateDirectory, sessionId),
    prototypeRequestFolder(requestId)
  )
}
