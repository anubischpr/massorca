import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { mcpToolIdentity } from '../../../../shared/native-chat-tool-identity'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { workspacePortScanKeyForTarget } from '@/lib/workspace-port-actions'
import { editFilesFromToolPair } from '../../../../shared/native-chat-edit-normalize'
import { toolFilePath } from '../../../../shared/native-chat-tool-summary'

/** Only explicit journal records are results; prose mentioning a file is not a file change. */
export function nativeChatSessionResults(items: readonly AgentJournalRenderItem[]): string[] {
  return [
    ...new Set(
      items.flatMap(({ body }) => {
        if (body.kind === 'diff') {
          return [body.path]
        }
        if (body.kind !== 'tool-call') {
          return []
        }
        return (
          editFilesFromToolPair({
            name: body.name,
            input: body.input,
            state: body.state,
            ...(body.output
              ? { result: { output: body.output.head, isError: body.state === 'failed' } }
              : {})
          }) ?? []
        )
          .filter((file) => file.path !== 'file' || toolFilePath(body.input) === 'file')
          .map((file) => file.path)
      })
    )
  ]
}

/** A tool result is historical evidence, never a claim that its connector is connected now. */
export function nativeChatSessionConnectors(items: readonly AgentJournalRenderItem[]) {
  const connectors = new Map<
    string,
    { server: string; tool: string; state: string; error: string | null }
  >()
  for (const { body } of items) {
    if (body.kind !== 'tool-call') {
      continue
    }
    const identity = mcpToolIdentity(body.name, body.mcpIdentity)
    if (!identity) {
      continue
    }
    connectors.set(identity.server, {
      ...identity,
      state: body.endedAs ?? body.state,
      error: body.state === 'failed' ? (body.output?.head ?? null) : null
    })
  }
  return [...connectors.values()]
}

/** Never borrow another host's aggregate scan for a selected chat. */
export function nativeChatSessionServers(
  scans: Record<string, WorkspacePortScanResult>,
  target: RuntimeClientTarget,
  worktreeId: string | null | undefined
) {
  const scan = scans[workspacePortScanKeyForTarget(target)]
  return {
    scan,
    ports:
      scan?.ports.filter(
        (port) => port.kind === 'workspace' && port.owner.worktreeId === worktreeId
      ) ?? []
  }
}
