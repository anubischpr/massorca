import { resolvePiDisplayRuntime } from '@/lib/pi-agent-display'
import { readHostPiRuntimeAnswer, recordHostPiRuntimeAnswer } from '@/lib/pi-host-runtime-answer'
import { askHostPiRuntimeForWorktree } from '@/lib/pi-terminal-host-runtime'
import {
  MARKETPLACE_APP_AGENTS,
  type MarketplaceAppAgent
} from '../../../../shared/marketplace-apps'
import type { HostPiTerminalRuntime } from '../../../../shared/pi-runtime-selection'
import type { CatalogCheck } from './MarketplaceCatalogRows'

/** This computer's board agents: those detected here, and Gentle Shell as the Pi runtime its host runs. */
export type LocalMarketplaceAgents = {
  detected: readonly MarketplaceAppAgent[]
  gentleShell: CatalogCheck<boolean>
}

export type LocalAgentsInput = {
  detectedIds: readonly string[]
  command: string | undefined
  hostAnswer: HostPiTerminalRuntime | undefined
}

export function localMarketplaceAgents(input: LocalAgentsInput): LocalMarketplaceAgents {
  return {
    detected: MARKETPLACE_APP_AGENTS.filter(
      (agent) => agent !== 'gentle-shell' && input.detectedIds.includes(agent)
    ),
    gentleShell: gentleShellCheck(input)
  }
}

/** Gentle Shell is the Pi entry on its own runtime, so it is found only when the Pi this host runs is Gentle Shell. */
function gentleShellCheck({
  detectedIds,
  command,
  hostAnswer
}: LocalAgentsInput): CatalogCheck<boolean> {
  if (!detectedIds.includes('pi')) {
    return { kind: 'ready', value: false }
  }
  const runtime = resolvePiDisplayRuntime({ command, hostAnswer })
  if (runtime === 'gentle-shell') {
    return { kind: 'ready', value: true }
  }
  if (runtime === 'pi' || hostAnswer === 'cliMissing') {
    return { kind: 'ready', value: false }
  }
  // Why: until the host answers the row is checking; an answer that names no runtime is not a missing install.
  return hostAnswer === undefined ? { kind: 'loading' } : { kind: 'failed' }
}

/** The workspace host's Pi answer, asked as the agent page asks it; a host that cannot answer reads as unknown. */
export async function readLocalPiAnswer(
  worktreeId: string,
  command: string | undefined
): Promise<HostPiTerminalRuntime | undefined> {
  if (!worktreeId) {
    return 'unknown'
  }
  const cached = readHostPiRuntimeAnswer(worktreeId)
  // Why: a Pi command names the runtime itself, and a settled answer is kept; a failed one is asked again.
  if (command?.trim() || (cached !== undefined && cached !== 'unknown')) {
    return cached
  }
  const asked = await askHostPiRuntimeForWorktree(worktreeId).catch(
    (): HostPiTerminalRuntime => 'unknown'
  )
  const answer: HostPiTerminalRuntime = asked ?? 'unknown'
  recordHostPiRuntimeAnswer(worktreeId, answer)
  return answer
}
