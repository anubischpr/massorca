import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { isRootAgentJournalItem } from '../../../../shared/agent-session-journal-producer'
import { codexPrimaryCommandTaskId } from '../../../../shared/structured-session-foreground-commands'
import { projectStructuredItemToNativeChat } from '../../../../shared/structured-agent-session-projection'
import { isToolCallBlock, isToolResultBlock } from '../../../../shared/native-chat-types'

export function nativeChatBackgroundCommandDetails(
  view: AgentChildWorkView,
  owners: readonly AgentChildWorkView[],
  items: readonly AgentJournalRenderItem[]
) {
  if (view.kind !== 'command' || !view.providerId) {
    return null
  }
  const owner = owners.find((candidate) => candidate.id === view.parentChildWorkId)
  const matches = items.filter((item) => {
    if (item.body.kind !== 'tool-call' || !item.body.callId) {
      return false
    }
    if (view.ownership === 'main') {
      return (
        isRootAgentJournalItem(item) &&
        view.providerId === codexPrimaryCommandTaskId(item.body.callId)
      )
    }
    if (view.ownership !== 'child' || owner?.kind !== 'agent' || !owner.providerId) {
      return false
    }
    // The host's command handle includes both producer thread and call identity.
    return (
      item.agentId === owner.providerId &&
      view.providerId ===
        `codex-command:thread:${encodeURIComponent(owner.providerId)}:${encodeURIComponent(item.body.callId)}`
    )
  })
  if (matches.length !== 1) {
    return null
  }
  const item = matches[0]
  if (!item) {
    return null
  }
  const message = projectStructuredItemToNativeChat(item)
  const call = message?.blocks.find(isToolCallBlock)
  return call ? { item, call, result: message?.blocks.find(isToolResultBlock) } : null
}
