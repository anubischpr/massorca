import { getAgentSessionOptionCatalog } from '../../../../shared/agent-session-option-catalog'
import type { AgentSessionModelOption } from '../../../../shared/agent-session-wire'
import { groupAntigravityModelVariants } from '../../../../shared/antigravity-model-variants'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { RuntimeDiscoverCommitMessageModelsResult } from '@/runtime/runtime-git-client-context'

/**
 * Picker rows from the agent CLI's own model listing, the one the chat composer falls back to.
 * Null when the listing failed, is empty, or is only a spec seed standing in for a real probe.
 */
export function createChatModelsFromCliListing(
  agent: TuiAgent,
  result: RuntimeDiscoverCommitMessageModelsResult
): AgentSessionModelOption[] | null {
  if (!result.success || result.models.length === 0) {
    return null
  }
  const authoritative =
    agent === 'claude' || getAgentSessionOptionCatalog(agent)?.discoveredModelsAreAuthoritative
  if (authoritative && result.catalogOrigin !== 'probe') {
    return null
  }
  const rows = result.models.map((model) => ({
    id: model.id,
    label: model.label,
    ...(model.description ? { description: model.description } : {}),
    isDefault: model.isDefault === true,
    ...(model.defaultThinkingLevel ? { defaultEffort: model.defaultThinkingLevel } : {}),
    efforts: (model.thinkingLevels ?? []).map((level) => ({
      value: level.id,
      label: level.label ?? level.id
    }))
  }))
  // Why: agy lists one id per effort; the picker shows each model once with its efforts.
  return agent === 'antigravity'
    ? groupAntigravityModelVariants(rows.map(({ efforts: _efforts, ...row }) => row))
    : rows
}
