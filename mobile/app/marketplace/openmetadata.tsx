import { useLocalSearchParams } from 'expo-router'
import { MarketplaceOpenMetadataScreen } from '../../src/marketplace/marketplace-openmetadata-screen'

export default function MarketplaceOpenMetadataRoute() {
  const { hostId } = useLocalSearchParams<{ hostId?: string }>()
  return <MarketplaceOpenMetadataScreen hostId={hostId} />
}
