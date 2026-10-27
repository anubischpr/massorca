// `agentSession.readRecordedFile` — a file this chat's agent wrote, read from the owning host.
//
// Additive: the host advertises `agent-session.recorded-file-read.v1`, but a client does not probe
// it; an older host answers `method_not_found`, which the client reads as "update the host". The
// generic remote file open stays restricted to the worktree: the set of servable paths is derived
// here, from the host's own journal for the session (completed calls of file-writing tools and
// provider diffs), and the client's path is only checked against it.

import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { writtenFilePathsFromJournalItems } from '../../../../shared/native-chat-journal-changed-paths'
import {
  ReadRecordedFileParams,
  type AgentSessionReadRecordedFileResult
} from '../../../../shared/rpc-contract/agent-session-recorded-file-params'
import {
  readAgentRecordedFile,
  recordedFileKeys
} from '../../../native-chat/agent-session-recorded-file-read'
import { defineMethod } from '../core'
import { remoteFileContentBudget } from './files-remote-content-budget'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_RECORDED_FILE_METHODS = [
  defineMethod({
    name: 'agentSession.readRecordedFile',
    permission: 'workspace',
    params: ReadRecordedFileParams,
    handler: async (params, ctx): Promise<AgentSessionReadRecordedFileResult> => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      const record = host.deps.store.getRecord(params.sessionId)
      if (!record) {
        return { ok: false, error: 'session_not_found' }
      }
      // Paths of a WSL distro or an SSH host are not this process's filesystem.
      if (
        record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
        record.location.wslDistro
      ) {
        return { ok: false, error: 'unsupported_location' }
      }
      const snapshot = await host.journalSnapshot(params.sessionId)
      return readAgentRecordedFile({
        path: params.path,
        mode: params.mode,
        recordedKeys: recordedFileKeys(writtenFilePathsFromJournalItems(snapshot.items)),
        // A remote reply must fit the connection's outbound budget, or the server closes the socket.
        maxContentBytes: remoteFileContentBudget(ctx.clientKind, ctx.requestId)
      })
    }
  })
]
