// Archiving and deleting one prototype request on the host. The folder is resolved here from the chat's
// session id and the request id, never from a client path, and a delete removes that one folder only.

import { lstat, realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { isPlainPathSegment, PROTOTYPE_FOLDER } from '../../shared/prototype-request-folder'
import { REQUEST_ID_PATTERN, type PrototypeRequestManifest } from '../../shared/prototype-sets'
import type {
  ArchivePrototypeRequestResult,
  DeletePrototypeRequestResult
} from '../../shared/rpc-contract/prototype-params'
import {
  nativeChatVisualsFolderFor,
  nativeChatVisualsFolderName,
  nativeChatVisualsRootFor
} from './native-chat-visuals-folder'
import {
  logPrototypeFailure,
  readRequestManifest,
  setRequestArchived
} from './prototype-request-disk'

type RequestTarget = {
  stateDirectory: string
  sessionId: string
  requestId: string
  /** Whether the caller may act on this request; a request it may not touch answers `not_found`. */
  canAct: (manifest: PrototypeRequestManifest) => boolean
}

/**
 * The request's folder and manifest, found the way the listing finds them: the folder is the session's
 * hashed one, its manifest names this request and session, and the folder really sits under the visuals root.
 */
async function findRequest(
  target: RequestTarget
): Promise<{ requestFolder: string; manifest: PrototypeRequestManifest } | null> {
  const { stateDirectory, sessionId, requestId } = target
  if (sessionId === '' || !REQUEST_ID_PATTERN.test(requestId) || !isPlainPathSegment(requestId)) {
    return null
  }
  const requestFolder = join(
    nativeChatVisualsFolderFor(stateDirectory, sessionId),
    PROTOTYPE_FOLDER,
    requestId
  )
  try {
    // Why lstat: a link planted as the request folder is not a request folder.
    if (!(await lstat(requestFolder)).isDirectory()) {
      return null
    }
    // Why realpath: a link in an ancestor must not carry the removal outside the visuals root.
    const expected = join(
      await realpath(nativeChatVisualsRootFor(stateDirectory)),
      nativeChatVisualsFolderName(sessionId),
      PROTOTYPE_FOLDER,
      requestId
    )
    if ((await realpath(requestFolder)) !== expected) {
      return null
    }
  } catch (error) {
    logPrototypeFailure('finding a prototype request', error)
    return null
  }
  const manifest = await readRequestManifest(requestFolder)
  if (manifest === null || manifest.requestId !== requestId || manifest.sessionId !== sessionId) {
    return null
  }
  return target.canAct(manifest) ? { requestFolder, manifest } : null
}

/** Marks a request archived or clears the mark; any set can be, whether or not its chat still exists. */
export async function setPrototypeRequestArchived(
  target: RequestTarget & { archived: boolean }
): Promise<ArchivePrototypeRequestResult> {
  const found = await findRequest(target)
  if (found === null) {
    return { ok: false, error: 'not_found' }
  }
  return (await setRequestArchived(found.requestFolder, target.archived))
    ? { ok: true }
    : { ok: false, error: 'unwritable' }
}

/** Removes the one request folder, only when the host says its chat or worktree is gone. */
export async function deletePrototypeRequest(
  target: RequestTarget & { isDeletable: () => Promise<boolean> }
): Promise<DeletePrototypeRequestResult> {
  const found = await findRequest(target)
  if (found === null) {
    return { ok: false, error: 'not_found' }
  }
  if (!(await target.isDeletable())) {
    return { ok: false, error: 'not_deletable' }
  }
  try {
    await rm(found.requestFolder, { recursive: true, force: true })
    return { ok: true }
  } catch (error) {
    logPrototypeFailure('deleting a prototype request', error)
    return { ok: false, error: 'unwritable' }
  }
}
