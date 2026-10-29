import { useEffect, useState } from 'react'
import { buildWorkspaceFileContext } from '@/lib/workspace-file-host-routing'
import { readRuntimeFilePreview } from '@/runtime/runtime-file-client'
import {
  isOutsideRemoteWorkspaceError,
  RecordedFileHostOutdatedError,
  RecordedFileRefusedError
} from '@/runtime/runtime-recorded-file-client'
import type { RuntimeFilePreviewResult } from '../../../../shared/runtime-file-contracts'

/** A recorded file to read. Compare by identity: a new object starts a new read. */
export type RecordedFileSource = {
  worktreeId: string
  worktreePath: string
  /** The chat's own host: the global active runtime may be another one, or none. */
  runtimeEnvironmentId: string | null
  sessionId: string
  path: string
}

export type RecordedFileFailureReason =
  | 'outdated'
  | 'outside'
  | 'missing'
  | 'tooLarge'
  | 'unavailable'

export type RecordedFileOutcome =
  | { kind: 'ready'; preview: RuntimeFilePreviewResult }
  | { kind: 'failed'; reason: RecordedFileFailureReason }

function failureReason(error: unknown): RecordedFileFailureReason {
  if (error instanceof RecordedFileHostOutdatedError) {
    return 'outdated'
  }
  if (isOutsideRemoteWorkspaceError(error)) {
    return 'outside'
  }
  if (error instanceof RecordedFileRefusedError) {
    if (error.reason === 'not_found') {
      return 'missing'
    }
    if (error.reason === 'too_large') {
      return 'tooLarge'
    }
  }
  return 'unavailable'
}

/** The outcome of reading this source, or null while its read is still in flight. */
export function useRecordedFilePreview(source: RecordedFileSource): RecordedFileOutcome | null {
  const [loaded, setLoaded] = useState<{
    source: RecordedFileSource
    outcome: RecordedFileOutcome
  } | null>(null)
  useEffect(() => {
    let current = true
    const settle = (outcome: RecordedFileOutcome): void => {
      if (current) {
        setLoaded({ source, outcome })
      }
    }
    // Why: the chat's own host, as the click that opened this resolved it.
    void readRuntimeFilePreview(
      {
        ...buildWorkspaceFileContext(
          source.worktreeId,
          source.worktreePath,
          source.runtimeEnvironmentId
        ),
        agentSessionId: source.sessionId
      },
      source.path
    ).then(
      (preview) => settle({ kind: 'ready', preview }),
      (error: unknown) => settle({ kind: 'failed', reason: failureReason(error) })
    )
    return () => {
      current = false
    }
  }, [source])
  return loaded?.source === source ? loaded.outcome : null
}
