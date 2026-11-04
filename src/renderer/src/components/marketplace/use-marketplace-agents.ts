import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import {
  MARKETPLACE_APP_AGENTS,
  type MarketplaceAppAgent
} from '../../../../shared/marketplace-apps'

/** Agents on this computer that the Marketplace wires apps into; null while detection runs. */
export function useMarketplaceAgents(): readonly MarketplaceAppAgent[] | null {
  const { detectedIds } = useDetectedAgents(null)
  const hasPi = detectedIds?.includes('pi') ?? false
  // Why: Gentle Shell is the Pi entry on its own runtime; a stock Pi install is not a Marketplace agent.
  const piRuntime = usePiDisplayRuntime({ enabled: hasPi })
  if (!detectedIds) {
    return null
  }
  return MARKETPLACE_APP_AGENTS.filter((agent) => {
    if (agent === 'gentle-shell') {
      return hasPi && piRuntime === 'gentle-shell'
    }
    return detectedIds.includes(agent)
  })
}
