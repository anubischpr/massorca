import type { RuntimeFilePreviewResult } from '../../../shared/runtime-file-contracts'
import {
  AGENT_SESSION_RECORDED_FILE_READ_ERRORS,
  type AgentSessionReadRecordedFileResult,
  type AgentSessionRecordedFileReadError
} from '../../../shared/rpc-contract/agent-session-recorded-file-params'
import type { RuntimeFileOperationArgs } from './runtime-file-client-types'
import { callRuntimeRpc, getActiveRuntimeTarget } from './runtime-rpc-client'
import { RemoteFileOutsideWorktreeError } from './runtime-file-routing'
import { hasRuntimeRpcErrorCode } from './runtime-rpc-result'

const READ_TIMEOUT_MS = 15_000

/** The paired host predates `agentSession.readRecordedFile`: the file may be fine, the host is old. */
export class RecordedFileHostOutdatedError extends Error {
  constructor() {
    super('The remote host does not support reading files the agent saved outside the workspace')
    this.name = 'RecordedFileHostOutdatedError'
  }
}

const REFUSAL_MESSAGES: Record<AgentSessionRecordedFileReadError, string> = {
  session_not_found: 'The remote host no longer has this chat',
  unsupported_location: 'This chat runs somewhere the host cannot read files from',
  not_recorded: 'The remote host has no record of the agent saving this file',
  not_found: 'File not found on the remote host',
  not_a_file: 'This is not a regular file',
  too_large: 'This file is too large to preview over the connection'
}

/** The host answered and refused. `not_recorded` is the security verdict; the rest describe the file. */
export class RecordedFileRefusedError extends Error {
  readonly reason: AgentSessionRecordedFileReadError

  constructor(reason: AgentSessionRecordedFileReadError) {
    // Worded so `isMissingRuntimePathError` reads `not_found` as a verified absence and nothing else.
    super(REFUSAL_MESSAGES[reason])
    this.name = 'RecordedFileRefusedError'
    this.reason = reason
  }
}

/** The chat's host has no record of the agent saving the file, so it stays out of reach. */
export function isOutsideRemoteWorkspaceError(error: unknown): boolean {
  return (
    error instanceof RemoteFileOutsideWorktreeError ||
    (error instanceof RecordedFileRefusedError && error.reason === 'not_recorded')
  )
}

function isKnownRefusal(value: unknown): value is AgentSessionRecordedFileReadError {
  return AGENT_SESSION_RECORDED_FILE_READ_ERRORS.some((known) => known === value)
}

async function readRecordedSessionFile(
  context: RuntimeFileOperationArgs,
  path: string,
  mode: 'stat' | 'preview'
): Promise<AgentSessionReadRecordedFileResult & { ok: true }> {
  const target = getActiveRuntimeTarget(context.settings)
  if (target.kind !== 'environment' || !context.agentSessionId) {
    throw new Error('A recorded file read needs a paired host and a chat')
  }
  let result: AgentSessionReadRecordedFileResult
  try {
    result = await callRuntimeRpc<AgentSessionReadRecordedFileResult>(
      target,
      'agentSession.readRecordedFile',
      { sessionId: context.agentSessionId, path, mode },
      { timeoutMs: READ_TIMEOUT_MS }
    )
  } catch (error) {
    // A host without the method, or one that does not let this client call it.
    if (hasRuntimeRpcErrorCode(error, 'method_not_found')) {
      throw new RecordedFileHostOutdatedError()
    }
    throw error
  }
  if (result.ok) {
    return result
  }
  if (isKnownRefusal(result.error)) {
    throw new RecordedFileRefusedError(result.error)
  }
  throw new Error(`Unexpected recorded file answer: ${String(result.error)}`)
}

export async function statRecordedSessionFile(
  context: RuntimeFileOperationArgs,
  path: string
): Promise<{ size: number; isDirectory: boolean; mtime: number }> {
  const result = await readRecordedSessionFile(context, path, 'stat')
  if (result.mode !== 'stat') {
    throw new Error('Unexpected recorded file answer: expected a stat')
  }
  return { size: result.size, isDirectory: false, mtime: result.mtime }
}

export async function previewRecordedSessionFile(
  context: RuntimeFileOperationArgs,
  path: string
): Promise<RuntimeFilePreviewResult> {
  const result = await readRecordedSessionFile(context, path, 'preview')
  if (result.mode !== 'preview') {
    throw new Error('Unexpected recorded file answer: expected a preview')
  }
  const { ok: _ok, mode: _mode, ...preview } = result
  return preview
}
