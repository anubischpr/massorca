// The prototype requests a host lists: each request folder under a chat's visuals folder, read into its
// directions and listed newest first. The reads are bounded, so the list every Prototypes open runs
// stays cheap, and a request that fails to read is left out alone.

import { join } from 'node:path'
import { PROTOTYPE_FOLDER, prototypeRequestFolder } from '../../shared/prototype-request-folder'
import {
  buildPrototypeSet,
  type PrototypeRequestManifest,
  type PrototypeSet
} from '../../shared/prototype-sets'
import type {
  ListPrototypeSetsResult,
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../shared/rpc-contract/prototype-params'
import { nativeChatVisualsFolderName, nativeChatVisualsRootFor } from './native-chat-visuals-folder'
import { directionNotesFor, withDirectionNotes } from './prototype-direction-notes'
import {
  fileMtime,
  fileNamesIn,
  gentleDesignSetFor,
  logPrototypeFailure,
  readDirectoryEntries,
  readRequestManifest
} from './prototype-request-disk'

// Scan bounds, so the list that every Prototypes open runs stays cheap. Chats are taken in name order;
// each chat keeps at most its newest request folders, so one busy chat cannot starve the others; and
// the whole scan keeps the newest request folders across chats.
const MAX_SESSION_FOLDERS_SCANNED = 500
const MAX_REQUEST_FOLDERS_PER_SESSION = 100
const MAX_REQUEST_FOLDERS_SCANNED = 500

export type ListPrototypeSetsOptions = {
  stateDirectory: string
  worktreeId?: string
  /** Whether a chat's request folders may be listed; omitted, every chat on this host is listed. */
  isChatListed?: (sessionId: string) => boolean
}

/**
 * Every request on this host, newest first. Sets without any direction file are left out, and a request
 * that fails to read is logged and left out without failing the others.
 */
export async function listPrototypeSets(
  options: ListPrototypeSetsOptions
): Promise<ListPrototypeSetsResult> {
  const root = nativeChatVisualsRootFor(options.stateDirectory)
  const sets: PrototypeListedSet[] = []
  for (const candidate of await requestFolderCandidates(root)) {
    try {
      const listed = await listedSetFor(candidate, options.worktreeId, options.isChatListed)
      if (listed !== null) {
        sets.push(listed)
      }
    } catch (error) {
      logPrototypeFailure('listing a prototype request', error)
    }
  }
  sets.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return { sets }
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
    .sort((left, right) => left.name.localeCompare(right.name))
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
  worktreeId: string | undefined,
  isChatListed: ((sessionId: string) => boolean) | undefined
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
  if (isChatListed !== undefined && !isChatListed(manifest.sessionId)) {
    return null
  }
  // Why recorded files first: a request lists the files its own folder holds, and its Gentle Shell design/
  // folder only when none is recorded, so one request never lists two sources.
  const recorded = await directionsWithMtime(
    buildPrototypeSet(manifest, await fileNamesIn(requestFolder)),
    candidate.visualsFolder
  )
  const directions =
    recorded.length > 0
      ? withDirectionNotes(
          recorded,
          manifest.agent === 'gentle-shell' ? [] : await directionNotesFor(requestFolder)
        )
      : await gentleDirectionsFor(requestFolder, manifest)
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

/** The Gentle Shell artboards bound to a request, with their last write times; none when no design folder is bound. */
async function gentleDirectionsFor(
  requestFolder: string,
  manifest: PrototypeRequestManifest
): Promise<PrototypeListedDirection[]> {
  const gentle = await gentleDesignSetFor(requestFolder, manifest)
  return gentle !== null && manifest.sessionCwd !== undefined
    ? directionsWithMtime(gentle, manifest.sessionCwd)
    : []
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
