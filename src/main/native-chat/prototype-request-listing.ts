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
  PrototypeListedDesignSystem,
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../shared/rpc-contract/prototype-params'
import { usesDesignSystemInstruction } from '../../shared/prototype-design-system-instruction'
import type { DesignSystemSummary } from '../../shared/prototype-design-system-summary'
import { nativeChatVisualsFolderName, nativeChatVisualsRootFor } from './native-chat-visuals-folder'
import { directionNotesFor, withDirectionNotes } from './prototype-direction-notes'
import { projectsOfLaunchDirectories } from './prototype-design-system-files'
import {
  fileMtime,
  fileNamesIn,
  gentleDesignSetFor,
  logPrototypeFailure,
  readDirectoryEntries,
  readRequestManifest,
  recordRequestDesignSystemVersion
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
  /** A chat's launch directory from its record; a Gentle Shell design/ folder is read only under it. */
  launchDirectoryOf?: (sessionId: string) => string | undefined
}

/**
 * Every request on this host, newest first. Sets without any direction file are left out, and a request
 * that fails to read is logged and left out without failing the others.
 */
export async function listPrototypeSets(
  options: ListPrototypeSetsOptions
): Promise<ListPrototypeSetsResult> {
  const root = nativeChatVisualsRootFor(options.stateDirectory)
  const requests: ListedRequest[] = []
  for (const candidate of await requestFolderCandidates(root)) {
    try {
      const listed = await listedRequestFor(candidate, options)
      if (listed !== null) {
        requests.push(listed)
      }
    } catch (error) {
      logPrototypeFailure('listing a prototype request', error)
    }
  }
  requests.sort((left, right) => right.set.createdAt.localeCompare(left.set.createdAt))
  return withProjects(requests, options)
}

/** A listed set with the request folder and manifest it came from, for the version it records. */
type ListedRequest = {
  set: PrototypeListedSet
  manifest: PrototypeRequestManifest
  requestFolder: string
}

/** Each set with its project, and one design system summary per project that has one. */
async function withProjects(
  requests: readonly ListedRequest[],
  options: ListPrototypeSetsOptions
): Promise<ListPrototypeSetsResult> {
  // Why the chat record and not the manifest: request.json sits in the folder the agent writes into.
  const launchDirectories = new Map<string, string>()
  for (const { set } of requests) {
    const launchDirectory = options.launchDirectoryOf?.(set.sessionId)
    if (launchDirectory !== undefined) {
      launchDirectories.set(set.sessionId, launchDirectory)
    }
  }
  const projects = await projectsOfLaunchDirectories(launchDirectories.values())
  const designSystems = new Map<string, PrototypeListedDesignSystem>()
  const sets: PrototypeListedSet[] = []
  for (const request of requests) {
    const { set } = request
    const project = projects.get(launchDirectories.get(set.sessionId) ?? '')
    if (project === undefined) {
      sets.push(set)
      continue
    }
    if (project.system !== undefined && !designSystems.has(project.projectKey)) {
      designSystems.set(project.projectKey, {
        projectKey: project.projectKey,
        projectName: project.projectName,
        ...project.system
      })
    }
    const builtOn = await builtOnOf(request, project.system)
    sets.push({
      ...set,
      projectKey: project.projectKey,
      projectName: project.projectName,
      ...(builtOn !== undefined ? { builtOn } : {})
    })
  }
  return {
    sets,
    ...(designSystems.size > 0 ? { designSystems: [...designSystems.values()] } : {})
  }
}

// Why first sight: a request sent before its project had a system carries no version, so the version the
// system has when the list first sees one is written into request.json and kept, as a Gentle Shell slug is.
async function builtOnOf(
  { set, manifest, requestFolder }: ListedRequest,
  system: DesignSystemSummary | undefined
): Promise<number | undefined> {
  if (
    set.builtOn !== undefined ||
    system === undefined ||
    !usesDesignSystemInstruction(manifest.designSystemMode)
  ) {
    return set.builtOn
  }
  const recorded = await recordRequestDesignSystemVersion(requestFolder, manifest, system.version)
  return recorded ? system.version : undefined
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

async function listedRequestFor(
  candidate: RequestFolderCandidate,
  options: ListPrototypeSetsOptions
): Promise<ListedRequest | null> {
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
  if (options.worktreeId !== undefined && manifest.worktreeId !== options.worktreeId) {
    return null
  }
  if (options.isChatListed !== undefined && !options.isChatListed(manifest.sessionId)) {
    return null
  }
  const launchDirectory = options.launchDirectoryOf?.(manifest.sessionId)
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
      : await gentleDirectionsFor(requestFolder, manifest, launchDirectory)
  if (directions.length === 0) {
    return null
  }
  return {
    set: {
      requestId: manifest.requestId,
      sessionId: manifest.sessionId,
      agent: manifest.agent,
      worktreeId: manifest.worktreeId ?? null,
      chatTitle: manifest.chatTitle ?? null,
      originalPrompt: manifest.originalPrompt,
      createdAt: manifest.createdAt,
      count: manifest.count,
      folderPath: requestFolder,
      ...(manifest.designSystemVersion !== undefined
        ? { builtOn: manifest.designSystemVersion }
        : {}),
      directions
    },
    manifest,
    requestFolder
  }
}

/** The Gentle Shell artboards bound to a request, with their last write times; none when no design folder is bound. */
async function gentleDirectionsFor(
  requestFolder: string,
  manifest: PrototypeRequestManifest,
  launchDirectory: string | undefined
): Promise<PrototypeListedDirection[]> {
  const gentle = await gentleDesignSetFor(requestFolder, manifest, launchDirectory)
  return gentle !== null && launchDirectory !== undefined
    ? directionsWithMtime(gentle, launchDirectory)
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
