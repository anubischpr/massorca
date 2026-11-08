import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { useHostPiRuntimeAnswer } from '@/lib/pi-host-runtime-answer'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { useAppStore } from '@/store'
import { localMarketplaceAgents, type LocalMarketplaceAgents } from './marketplace-local-agents'

/** The agents on this computer that the Marketplace wires apps into; null while detection runs. */
export function useMarketplaceAgents(): LocalMarketplaceAgents | null {
  const { detectedIds } = useDetectedAgents(null)
  const hasPi = detectedIds?.includes('pi') ?? false
  const worktreeId = useAppStore((state) => state.activeWorktreeId ?? '')
  const command = useAppStore((state) => state.settings?.agentCmdOverrides?.pi)
  // Why: the agent page's own Pi question; it asks the workspace host once and caches the answer.
  const piRuntime = usePiDisplayRuntime({ enabled: hasPi })
  const hostAnswer = useHostPiRuntimeAnswer(worktreeId)
  if (!detectedIds) {
    return null
  }
  return localMarketplaceAgents({
    detectedIds,
    command,
    // Why: a runtime the page resolved wins; until then the host's own answer says checking, failed or missing.
    hostAnswer: piRuntime !== 'unknown' ? piRuntime : worktreeId ? hostAnswer : 'unknown'
  })
}
