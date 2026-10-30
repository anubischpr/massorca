import { Pressable, StyleSheet, Text, View } from 'react-native'
import { draftTokenValue } from '../../../src/shared/prototype-design-system-draft'
import { designSystemSectionsOf } from '../../../src/shared/prototype-design-system-view'
import type { DesignSystemViewState } from '../../../src/shared/prototype-design-system-view-state'
import { colors, spacing, typography } from '../theme/mobile-theme'
import {
  mobileComponentMeta,
  mobileTokenSummaryLines
} from './mobile-prototype-design-system-model'
import type { MobileDesignSystemPanelProps } from './mobile-prototype-design-system-props'

type TabProps = Pick<MobileDesignSystemPanelProps, 'content' | 'state'>

/** The Tokens tab: the color tokens as tiles, then the type, space and radius summary. */
export function MobilePrototypeDesignSystemTokens({
  content,
  state,
  tokenSheetOpen,
  onPickToken
}: TabProps & { tokenSheetOpen: boolean; onPickToken: (tokenId: string) => void }) {
  const colorTokens = designSystemSectionsOf(content.tokens).color
  const summary = mobileTokenSummaryLines(content.tokens)
  const selected = state.selection?.kind === 'token' && tokenSheetOpen ? state.selection.id : null
  return (
    <>
      {colorTokens.length === 0 ? null : (
        <>
          <Text style={styles.section}>Color</Text>
          <View style={styles.grid}>
            {colorTokens.map((token) => {
              const value = draftTokenValue(state.draft, token)
              return (
                <Pressable
                  key={token.id}
                  accessibilityRole="button"
                  accessibilityLabel={token.id}
                  onPress={() => onPickToken(token.id)}
                  style={[styles.tile, selected === token.id && styles.tileSelected]}
                >
                  <View style={[styles.tileSwatch, { backgroundColor: value }]} />
                  <View style={styles.tileText}>
                    <Text style={styles.mono} numberOfLines={1}>
                      {token.name}
                    </Text>
                    <Text style={styles.monoMuted} numberOfLines={1}>
                      {value}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </>
      )}
      {summary.length === 0 ? null : (
        <>
          <Text style={styles.section}>Type · Space · Radius</Text>
          <View style={styles.summary}>
            {summary.map((line) => (
              <Text key={line} style={styles.summaryLine}>
                {line}
              </Text>
            ))}
          </View>
        </>
      )}
    </>
  )
}

/** The Components tab: Add component, each component and the ones the draft adds. */
export function MobilePrototypeDesignSystemComponents({
  content,
  state,
  onAdd,
  onPickComponent
}: TabProps & { onAdd: () => void; onPickComponent: (name: string) => void }) {
  return (
    <>
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.add}>
        <Text style={styles.addText}>+ Add component</Text>
      </Pressable>
      {content.components.map((section) => {
        const removed = state.draft.removed[section.name] === true
        const meta = mobileComponentMeta(section, state.draft)
        return (
          <Pressable
            key={section.name}
            accessibilityRole="button"
            accessibilityLabel={section.name}
            onPress={() => onPickComponent(section.name)}
            style={[styles.component, removed && styles.removed]}
          >
            <View style={styles.componentText}>
              <Text style={styles.componentName}>{section.name}</Text>
              {meta === '' ? null : <Text style={styles.componentMeta}>{meta}</Text>}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )
      })}
      {addedKeys(state).map(({ key, description }) => (
        <View key={key} style={styles.added}>
          <Text style={styles.componentName}>{description}</Text>
          <Text style={styles.addedNote}>To be added by the agent · in the draft</Text>
        </View>
      ))}
    </>
  )
}

/** The Source tab: each file the system was detected from, and what was taken from it. */
export function MobilePrototypeDesignSystemSource({ content }: Pick<TabProps, 'content'>) {
  return (
    <View style={styles.sources}>
      {content.meta.sources.map((source, index) => (
        // A source's path can repeat; its place keeps the two apart.
        <View key={`${index}:${source.path}`} style={styles.source}>
          <Text style={styles.sourcePath}>{source.path}</Text>
          <Text style={styles.sourceTook}>{source.took}</Text>
        </View>
      ))}
    </View>
  )
}

// A description can repeat; how many equal ones came before it keeps the keys apart.
function addedKeys(state: DesignSystemViewState): { key: string; description: string }[] {
  const seen = new Map<string, number>()
  return state.draft.added.map((description) => {
    const occurrence = seen.get(description) ?? 0
    seen.set(description, occurrence + 1)
    return { key: `${description}\u0000${occurrence}`, description }
  })
}

const styles = StyleSheet.create({
  section: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.65,
    textTransform: 'uppercase'
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  tileSelected: { borderColor: colors.accentBlue, borderWidth: 2 },
  tileSwatch: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textMuted
  },
  tileText: { flex: 1, minWidth: 0 },
  mono: { color: colors.textPrimary, fontFamily: typography.monoFamily, fontSize: 12 },
  monoMuted: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: 11
  },
  summary: { gap: 6 },
  summaryLine: { color: colors.textPrimary, fontFamily: typography.monoFamily, fontSize: 12 },
  add: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  addText: { color: colors.textPrimary, fontSize: 14 },
  component: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  removed: { opacity: 0.4 },
  componentText: { flex: 1, minWidth: 0, gap: 2 },
  componentName: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  componentMeta: {
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: 12
  },
  chevron: { color: colors.textSecondary },
  added: {
    minHeight: 56,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted
  },
  addedNote: { color: colors.textSecondary, fontSize: typography.metaSize },
  sources: { gap: spacing.sm },
  source: { gap: 2 },
  sourcePath: { color: colors.textPrimary, fontFamily: typography.monoFamily, fontSize: 13 },
  sourceTook: { color: colors.textSecondary, fontSize: 13 }
})
