import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useHostClient } from '../transport/client-context'
import { colors } from '../theme/mobile-theme'
import { CatalogIcon } from './marketplace-catalog-row'
import { buildCatalogItems } from './marketplace-catalog-items'
import {
  catalogActionLabel,
  catalogBadgeTone,
  catalogYourApps,
  type CatalogItem
} from './marketplace-catalog-model'
import {
  MarketplaceNotice,
  MarketplacePending,
  MarketplaceScreenFrame
} from './marketplace-screen-frame'
import { marketplaceStyles as styles } from './marketplace-styles'
import { useMarketplaceHostData, useMarketplaceHostName } from './use-marketplace-host-data'

export function MarketplaceYourAppsScreen({ hostId }: { hostId: string | undefined }) {
  const router = useRouter()
  const hostName = useMarketplaceHostName(hostId)
  const { client, state } = useHostClient(hostId)
  const connected = state === 'connected'
  const data = useMarketplaceHostData(client, connected)
  const rows = catalogYourApps(buildCatalogItems(data))
  const failed = data.loaded && data.apps === null && data.tools === null && data.agentIds === null

  const openRow = (item: CatalogItem) => {
    if (item.openPath !== null && hostId !== undefined) {
      router.push({ pathname: item.openPath, params: { hostId } })
    }
  }

  return (
    <MarketplaceScreenFrame title="Your apps" onBack={() => router.back()}>
      <Text style={styles.note}>
        What is installed on each host, and the services you connected.
      </Text>
      {!data.loaded && hostId !== undefined ? (
        <MarketplacePending connected={connected} hostName={hostName} />
      ) : null}
      {failed ? <MarketplaceNotice bad text={`Could not load from ${hostName}.`} /> : null}

      {rows.installed.length > 0 ? (
        <>
          <Text style={styles.label}>Installed</Text>
          <View style={styles.card}>
            {rows.installed.map((item, index) => (
              <YourAppRow
                key={item.id}
                item={item}
                first={index === 0}
                hostName={hostName}
                onOpen={openRow}
              />
            ))}
          </View>
        </>
      ) : null}

      {rows.connected.length > 0 ? (
        <>
          <Text style={styles.label}>Connected</Text>
          <View style={styles.card}>
            {rows.connected.map((item, index) => (
              <YourAppRow
                key={item.id}
                item={item}
                first={index === 0}
                hostName={hostName}
                onOpen={openRow}
              />
            ))}
          </View>
        </>
      ) : null}
    </MarketplaceScreenFrame>
  )
}

function YourAppRow({
  item,
  first,
  hostName,
  onOpen
}: {
  item: CatalogItem
  first: boolean
  hostName: string
  onOpen: (item: CatalogItem) => void
}) {
  const badgeStyle =
    catalogBadgeTone(item.state) === 'ok' ? [styles.badge, styles.badgeOk] : styles.badge
  return (
    <Pressable
      accessibilityRole="button"
      disabled={item.openPath === null}
      style={({ pressed }) => [styles.row, first && styles.rowFirst, pressed && styles.rowPressed]}
      onPress={() => onOpen(item)}
    >
      <View style={styles.tile}>
        <CatalogIcon icon={item.icon} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowDesc} numberOfLines={1}>
          {hostName}
        </Text>
      </View>
      <Text style={badgeStyle}>{catalogActionLabel(item.state)}</Text>
      {item.openPath !== null ? <ChevronRight size={14} color={colors.textMuted} /> : null}
    </Pressable>
  )
}
