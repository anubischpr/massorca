import { useLocalSearchParams } from 'expo-router'
import { MarketplaceGitScreen } from '../../src/marketplace/marketplace-app-detail-screens'

export default function MarketplaceGitRoute() {
  const { hostId } = useLocalSearchParams<{ hostId?: string }>()
  return <MarketplaceGitScreen hostId={hostId} />
}
