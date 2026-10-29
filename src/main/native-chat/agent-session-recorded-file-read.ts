// Reading a file the chat's agent wrote, for a paired client that cannot reach outside the
// worktree. The client's path is only a claim: it is served when it exactly matches a path the
// host's own journal recorded the agent changing, and then only as a regular file (never a link).

import { constants } from 'node:fs'
import { lstat, open } from 'node:fs/promises'
import { extname, isAbsolute } from 'node:path'
import { isBinaryBuffer } from '../../shared/binary-buffer'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import {
  NodeFileReadTooLargeError,
  readNodeFileHandleWithinLimit
} from '../../shared/node-bounded-file-reader'
import type {
  AgentSessionReadRecordedFileResult,
  AgentSessionRecordedFileReadError
} from '../../shared/rpc-contract/agent-session-recorded-file-params'
import {
  LOCAL_PREVIEWABLE_BINARY_MAX_BYTES,
  MOBILE_FILE_READ_MAX_BYTES,
  RUNTIME_PREVIEWABLE_BINARY_MIME_TYPES,
  assertPreviewWithinTransportBudget,
  previewableBinaryByteLimit
} from '../runtime/runtime-file-commands-mobile-file-list-limit'

const OPEN_NOFOLLOW = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0
// A writer-less FIFO would block the open forever; non-blocking returns at once and leaves regular
// files unchanged.
const OPEN_NONBLOCK = typeof constants.O_NONBLOCK === 'number' ? constants.O_NONBLOCK : 0

/** A path this host can name unambiguously: absolute, free of `..`, and not a UNC or device path
 *  (`\\host\share`, `\\.\`), which would reach a network share or a raw device. A relative or `~`
 *  spelling needs the agent's cwd to mean anything, so it is never served either. */
function isServablePath(path: string): boolean {
  return (
    isAbsolute(path) &&
    !path.split(/[\\/]/).includes('..') &&
    !path.startsWith('\\\\') &&
    !(process.platform === 'win32' && path.startsWith('//'))
  )
}

/** Comparison key to the recorded spelling. The key only decides membership: the file opened is
 *  the one the agent wrote, never the client's variant of its name (NFC/NFD, `//`, a trailing
 *  slash), which on a normalization-sensitive filesystem can be another file. */
export function recordedFileKeys(paths: readonly string[]): Map<string, string> {
  return new Map(
    paths
      .filter(isServablePath)
      .map((path) => [normalizeRuntimePathForComparison(path), path] as const)
  )
}

function refusal(error: AgentSessionRecordedFileReadError): AgentSessionReadRecordedFileResult {
  return { ok: false, error }
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

function isMissing(error: unknown): boolean {
  const code = errorCode(error)
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function previewMaxBytes(isBinaryMime: boolean, maxContentBytes: number | undefined): number {
  if (!isBinaryMime) {
    return MOBILE_FILE_READ_MAX_BYTES
  }
  return maxContentBytes === undefined
    ? LOCAL_PREVIEWABLE_BINARY_MAX_BYTES
    : previewableBinaryByteLimit(maxContentBytes)
}

export async function readAgentRecordedFile(input: {
  path: string
  mode: 'stat' | 'preview'
  recordedKeys: ReadonlyMap<string, string>
  /** The reply's byte budget on a remote connection; undefined for an in-process caller. */
  maxContentBytes?: number
}): Promise<AgentSessionReadRecordedFileResult> {
  const { mode, maxContentBytes } = input
  const path = isServablePath(input.path)
    ? input.recordedKeys.get(normalizeRuntimePathForComparison(input.path))
    : undefined
  if (path === undefined) {
    return refusal('not_recorded')
  }
  let linkStats: Awaited<ReturnType<typeof lstat>>
  try {
    linkStats = await lstat(path)
  } catch (error) {
    if (isMissing(error)) {
      return refusal('not_found')
    }
    throw error
  }
  // lstat, so a link is not a file: the agent's write is what is served, never what a link points at.
  if (!linkStats.isFile()) {
    return refusal('not_a_file')
  }
  if (mode === 'stat') {
    return {
      ok: true,
      mode: 'stat',
      size: linkStats.size,
      isDirectory: false,
      mtime: linkStats.mtimeMs
    }
  }

  const binaryMimeType = RUNTIME_PREVIEWABLE_BINARY_MIME_TYPES[extname(path).toLowerCase()]
  try {
    const handle = await open(path, constants.O_RDONLY | OPEN_NOFOLLOW | OPEN_NONBLOCK)
    try {
      // The handle, not the earlier lstat, decides: a swap to a device or link after it is refused.
      const { buffer } = await readNodeFileHandleWithinLimit(
        handle,
        previewMaxBytes(Boolean(binaryMimeType), maxContentBytes),
        { regularFileOnly: true }
      )
      const preview = binaryMimeType
        ? {
            content: buffer.toString('base64'),
            isBinary: true,
            isImage: true,
            mimeType: binaryMimeType
          }
        : isBinaryBuffer(buffer)
          ? { content: '', isBinary: true }
          : { content: buffer.toString('utf8'), isBinary: false }
      return {
        ok: true,
        mode: 'preview',
        ...assertPreviewWithinTransportBudget(preview, maxContentBytes)
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (error instanceof NodeFileReadTooLargeError || isTooLargeForTransport(error)) {
      return refusal('too_large')
    }
    if (isMissing(error)) {
      return refusal('not_found')
    }
    // ELOOP: a link swapped in after the lstat.
    if (errorCode(error) === 'ELOOP' || isNotRegularFile(error)) {
      return refusal('not_a_file')
    }
    throw error
  }
}

function isTooLargeForTransport(error: unknown): boolean {
  return error instanceof Error && error.message === 'file_too_large'
}

function isNotRegularFile(error: unknown): boolean {
  return error instanceof Error && error.message === 'Expected a regular file'
}
