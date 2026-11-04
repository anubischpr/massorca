import { useLocalSearchParams } from 'expo-router'
import { MarketplaceEngramScreen } from '../../src/marketplace/marketplace-engram-screen'

export default function MarketplaceEngramRoute() {
  const { hostId } = useLocalSearchParams<{ hostId?: string }>()
  return <MarketplaceEngramScreen hostId={hostId} />
}
