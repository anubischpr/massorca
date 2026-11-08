import { useLocalSearchParams } from 'expo-router'
import { MarketplaceAgentScreen } from '../../../src/marketplace/marketplace-app-detail-screens'

export default function MarketplaceAgentRoute() {
  const { agentId, hostId } = useLocalSearchParams<{ agentId?: string; hostId?: string }>()
  return <MarketplaceAgentScreen hostId={hostId} agentId={agentId} />
}
