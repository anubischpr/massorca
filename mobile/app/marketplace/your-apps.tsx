import { useLocalSearchParams } from 'expo-router'
import { MarketplaceYourAppsScreen } from '../../src/marketplace/marketplace-your-apps-screen'

export default function MarketplaceYourAppsRoute() {
  const { hostId } = useLocalSearchParams<{ hostId?: string }>()
  return <MarketplaceYourAppsScreen hostId={hostId} />
}
