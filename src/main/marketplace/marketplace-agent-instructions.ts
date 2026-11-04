import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { editTextFileWithBackup } from './agent-file-write'
import {
  hasForeignEngramInstructions,
  hasInstructionsBlock,
  withInstructionsBlock,
  withoutInstructionsBlock,
  type InstructionsBlockId
} from './instructions-block-edit'
import { isAgentPresent, type MarketplaceAgentPaths } from './marketplace-agent-paths'

export type InstructionsOutcome =
  | 'added'
  | 'removed'
  | 'unchanged'
  /** The file already has an Engram section written by someone else. */
  | 'foreign-present'
  | 'not-supported'

export type InstructionsResult =
  | { ok: true; outcome: InstructionsOutcome }
  | { ok: false; reason: 'unreadable-config' | 'unsupported-shape' | 'failed' }

/** Adds or removes MassOrca's marked block in the agent's user-level instructions file. */
export function applyAgentInstructionsBlock(
  agent: MarketplaceAppAgent,
  paths: MarketplaceAgentPaths,
  id: InstructionsBlockId,
  enabled: boolean
): InstructionsResult {
  const path = paths.instructions(agent)
  if (!path || !isAgentPresent(agent, paths)) {
    return { ok: true, outcome: 'not-supported' }
  }
  let outcome: InstructionsOutcome = 'unchanged'
  const result = editTextFileWithBackup(
    path,
    (current) => {
      const source = current ?? ''
      if (!enabled) {
        outcome = hasInstructionsBlock(source, id) ? 'removed' : 'unchanged'
        return withoutInstructionsBlock(current, id)
      }
      if (id === 'engram' && hasForeignEngramInstructions(source)) {
        outcome = 'foreign-present'
        return source
      }
      outcome = hasInstructionsBlock(source, id) ? 'unchanged' : 'added'
      return withInstructionsBlock(current, id)
    },
    'text'
  )
  return result.kind === 'failed' ? { ok: false, reason: result.reason } : { ok: true, outcome }
}
