import { Pressable, Text, View } from 'react-native'
import type { MarketplaceAppAgent } from '../../../src/shared/marketplace-apps'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { MarketplaceGlyph } from './marketplace-glyphs'
import {
  catalogActionLabel,
  catalogActionTone,
  type CatalogActionTone,
  type CatalogIcon as CatalogIconSpec,
  type CatalogItem
} from './marketplace-catalog-model'
import { marketplaceStyles as styles } from './marketplace-styles'

/** Gentle Shell keeps its rose mark: the host runs it as a Pi runtime, so it is drawn as one. */
function agentMark(agentId: MarketplaceAppAgent): { agentId: string; piRuntime?: 'gentle-shell' } {
  return agentId === 'gentle-shell' ? { agentId: 'pi', piRuntime: 'gentle-shell' } : { agentId }
}

export function CatalogIcon({ icon, size = 18 }: { icon: CatalogIconSpec; size?: number }) {
  if (icon.kind === 'glyph') {
    return <MarketplaceGlyph name={icon.glyph} size={size} />
  }
  const mark = agentMark(icon.agentId)
  return <MobileAgentIcon agentId={mark.agentId} piRuntime={mark.piRuntime} size={size} />
}

function actionTextStyle(tone: CatalogActionTone) {
  switch (tone) {
    case 'ok':
      return styles.actionOkText
    case 'quiet':
      return styles.actionGhostText
    case 'secondary':
      return null
  }
}

export function CatalogRow({
  item,
  first,
  onOpen
}: {
  item: CatalogItem
  first: boolean
  onOpen: (path: string) => void
}) {
  const tone = catalogActionTone(item.state)
  const openPath = item.openPath
  const actionPath = item.actionPath
  const actionStyle = [
    styles.actionBase,
    tone === 'secondary' ? styles.actionSecondary : styles.actionGhost,
    actionPath === null && styles.disabled
  ]
  return (
    <View style={[styles.row, styles.catalogRow, first && styles.rowFirst]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        disabled={openPath === null}
        style={styles.rowMain}
        onPress={() => {
          if (openPath !== null) {
            onOpen(openPath)
          }
        }}
      >
        <View style={styles.tile}>
          <CatalogIcon icon={item.icon} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          <Text style={styles.rowDesc} numberOfLines={1}>
            {item.desc}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${catalogActionLabel(item.state)} ${item.name}`}
        disabled={actionPath === null}
        style={actionStyle}
        onPress={() => {
          if (actionPath !== null) {
            onOpen(actionPath)
          }
        }}
      >
        <Text style={[styles.actionText, actionTextStyle(tone)]}>
          {catalogActionLabel(item.state)}
        </Text>
      </Pressable>
    </View>
  )
}
