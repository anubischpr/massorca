import { useLocalSearchParams } from 'expo-router'
import { MarketplaceGitHubScreen } from '../../src/marketplace/marketplace-app-detail-screens'

export default function MarketplaceGitHubRoute() {
  const { hostId } = useLocalSearchParams<{ hostId?: string }>()
  return <MarketplaceGitHubScreen hostId={hostId} />
}
