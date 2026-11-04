import { MARKETPLACE_APP_AGENTS, type MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { applyAgentInstructionsBlock } from './marketplace-agent-instructions'
import { applyAgentMcpEdits, type McpEntryEdit } from './marketplace-agent-config'
import type { MarketplaceAgentPaths } from './marketplace-agent-paths'
import type { MarketplaceState } from './marketplace-vault'

export type WrittenApp = 'engram' | 'openmetadata'

export type AgentFailure = {
  agent: MarketplaceAppAgent
  reason: 'unreadable-config' | 'unsupported-shape' | 'failed'
}

export type AppWritePlan = {
  app: WrittenApp
  /** The edits for one agent, given the entry names MassOrca wrote there earlier. */
  entries: (agent: MarketplaceAppAgent, owned: ReadonlySet<string>) => McpEntryEdit[]
  instructions: 'add' | 'remove' | 'keep'
}

/**
 * Applies a plan to every agent and records in `state` exactly what MassOrca wrote, so a later
 * disconnect removes that and nothing else. An agent that fails keeps its earlier record and the
 * others carry on; the first failure is returned.
 */
export function runAppWrites(
  state: MarketplaceState,
  plan: AppWritePlan,
  paths: MarketplaceAgentPaths
): AgentFailure | null {
  const written = state.written[plan.app]
  let failure: AgentFailure | null = null
  for (const agent of MARKETPLACE_APP_AGENTS) {
    const before = written[agent] ?? { entries: [], instructions: false }
    const entries = new Set(before.entries)
    let instructions = before.instructions
    const edits = plan.entries(agent, new Set(before.entries))
    if (edits.length > 0) {
      const result = applyAgentMcpEdits(agent, paths, edits)
      if (!result.ok) {
        failure ??= { agent, reason: result.reason }
        continue
      }
      if (result.skipped) {
        // Why: an agent that is gone has none of its entries left to remove.
        edits.forEach((edit) => edit.action === 'remove' && entries.delete(edit.name))
      }
      for (const [name, outcome] of Object.entries(result.outcomes)) {
        if (outcome === 'added' || outcome === 'updated' || outcome === 'unchanged') {
          entries.add(name)
        } else if (outcome === 'removed' || outcome === 'absent') {
          entries.delete(name)
        }
      }
    }
    // Why: only a block MassOrca recorded writing is MassOrca's to remove.
    if (plan.instructions === 'add' || (plan.instructions === 'remove' && before.instructions)) {
      const result = applyAgentInstructionsBlock(
        agent,
        paths,
        plan.app,
        plan.instructions === 'add'
      )
      if (!result.ok) {
        failure ??= { agent, reason: result.reason }
      } else if (plan.instructions === 'remove') {
        instructions = false
      } else {
        instructions =
          result.outcome === 'added' || (result.outcome === 'unchanged' && instructions)
      }
    }
    if (entries.size > 0 || instructions) {
      written[agent] = { entries: [...entries], instructions }
    } else {
      delete written[agent]
    }
  }
  return failure
}
