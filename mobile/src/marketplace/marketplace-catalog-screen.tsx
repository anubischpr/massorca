import { Fragment, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Check, ChevronDown, ChevronRight } from 'lucide-react-native'
import { useHostClient } from '../transport/client-context'
import { MobileSearchField } from '../components/MobileSearchField'
import { PickerListDrawer } from '../components/PickerListDrawer'
import { colors } from '../theme/mobile-theme'
import { CatalogRow } from './marketplace-catalog-row'
import { buildCatalogItems } from './marketplace-catalog-items'
import {
  CATALOG_TABS,
  catalogSections,
  catalogYourApps,
  type CatalogTabId
} from './marketplace-catalog-model'
import { MarketplaceGlyph } from './marketplace-glyphs'
import {
  MarketplaceNotice,
  MarketplacePending,
  MarketplaceScreenFrame
} from './marketplace-screen-frame'
import { marketplaceStyles as styles } from './marketplace-styles'
import { useMarketplaceHostData, useMarketplaceHostList } from './use-marketplace-host-data'

export function MarketplaceCatalogScreen() {
  const router = useRouter()
  const hosts = useMarketplaceHostList()
  const [pickedHostId, setPickedHostId] = useState<string | null>(null)
  const [hostsOpen, setHostsOpen] = useState(false)
  const [tab, setTab] = useState<CatalogTabId>('all')
  const [query, setQuery] = useState('')

  const host = hosts.find((entry) => entry.id === pickedHostId) ?? hosts[0] ?? null
  const hostId = host?.id
  const hostName = host?.name ?? ''
  const { client, state } = useHostClient(hostId)
  const connected = state === 'connected'
  const data = useMarketplaceHostData(client, connected)

  const items = buildCatalogItems(data)
  const yours = catalogYourApps(items)
  const sections = catalogSections(items, tab, query)
  const failed =
    data.loaded &&
    data.apps === null &&
    data.tools === null &&
    data.agentIds === null &&
    data.piRuntimes === null

  const openPath = (path: string) => {
    if (hostId !== undefined) {
      router.push({ pathname: path, params: { hostId } })
    }
  }

  return (
    <MarketplaceScreenFrame title="Marketplace" onBack={() => router.back()}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a host"
        disabled={hosts.length === 0}
        style={styles.hostPill}
        onPress={() => setHostsOpen(true)}
      >
        <MarketplaceGlyph name="server" size={12} color={colors.textSecondary} />
        <Text style={styles.hostPillOn}>On</Text>
        <Text style={styles.hostPillName}>{hostName}</Text>
        <ChevronDown size={12} color={colors.textMuted} />
      </Pressable>

      <MobileSearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
        accessibilityLabel="Search the Marketplace"
      />

      <View style={styles.chips}>
        {CATALOG_TABS.map((entry) => {
          const selected = tab === entry.id
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => setTab(entry.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{entry.name}</Text>
            </Pressable>
          )
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          styles.row,
          styles.rowFirst,
          pressed && styles.rowPressed
        ]}
        onPress={() => openPath('/marketplace/your-apps')}
      >
        <Check size={16} color={colors.textPrimary} />
        <Text style={[styles.rowTitle, styles.rowText]}>Your apps</Text>
        <Text style={styles.rowMeta}>{String(yours.count)}</Text>
        <ChevronRight size={14} color={colors.textMuted} />
      </Pressable>

      {!data.loaded && hostId !== undefined ? (
        <MarketplacePending connected={connected} hostName={hostName} />
      ) : null}
      {failed ? <MarketplaceNotice bad text={`Could not load from ${hostName}.`} /> : null}

      {sections.map((section) => (
        <Fragment key={section.kind}>
          <Text style={styles.label}>
            {section.name}
            <Text style={styles.labelCount}>{String(section.count)}</Text>
          </Text>
          <View style={styles.card}>
            {section.items.map((item, index) => (
              <CatalogRow key={item.id} item={item} first={index === 0} onOpen={openPath} />
            ))}
          </View>
        </Fragment>
      ))}

      <PickerListDrawer
        visible={hostsOpen}
        title="Install on"
        items={hosts.map((entry) => ({
          id: entry.id,
          label: entry.name,
          detail: 'Paired with this phone'
        }))}
        selectedId={hostId ?? ''}
        onSelect={(picked) => setPickedHostId(picked.id)}
        onClose={() => setHostsOpen(false)}
      />
    </MarketplaceScreenFrame>
  )
}
