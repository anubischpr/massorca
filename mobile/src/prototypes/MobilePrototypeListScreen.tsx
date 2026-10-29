import { useMemo, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { prototypeAgentMono, type PrototypeListRow } from '../../../src/shared/prototype-list-model'
import { useNow } from '../hooks/use-now'
import {
  ArtifactScrollScopeContext,
  type ArtifactScrollScope
} from '../session/mobile-artifact-scroll-scope'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { MobilePrototypeTile } from './MobilePrototypeTile'
import {
  MOBILE_PROTOTYPE_FILTERS,
  buildMobilePrototypeRows,
  mobilePrototypeAgentLabel,
  mobilePrototypeFilterLabel,
  mobilePrototypeStatusLabel
} from './mobile-prototype-list-model'
import { mobilePrototypeStateKey, useMobilePrototypeViewStore } from './mobile-prototype-view-store'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'

/** Every agent's prototype sets: This chat or All agents, narrowed by agent, newest first. */
export function MobilePrototypeListScreen({
  hostId,
  sessionId,
  onBack,
  onOpenSet
}: {
  hostId: string
  /** The chat the list was opened from; "This chat" shows its sets. */
  sessionId: string | null
  onBack: () => void
  onOpenSet: (row: PrototypeListRow) => void
}) {
  const { client } = useHostClient(hostId)
  const listed = useMobilePrototypeSets(hostId)
  const scope = useMobilePrototypeViewStore((s) => s.scope)
  const setScope = useMobilePrototypeViewStore((s) => s.setScope)
  const filter = useMobilePrototypeViewStore((s) => s.filter)
  const setFilter = useMobilePrototypeViewStore((s) => s.setFilter)
  const states = useMobilePrototypeViewStore((s) => s.states)
  const now = useNow(60_000)
  const rows = useMemo(
    () =>
      buildMobilePrototypeRows({
        sets: listed.sets,
        scope,
        sessionId,
        filter,
        activeLetterOf: (requestId) => states[mobilePrototypeStateKey(hostId, requestId)]?.active,
        nowMs: now
      }),
    [listed.sets, scope, sessionId, filter, states, hostId, now]
  )
  // Tiles near the viewport draw their pages; scrolling tells them to look again.
  const viewport = useRef<View>(null)
  const scrollListeners = useRef(new Set<() => void>())
  const tileScope = useMemo<ArtifactScrollScope>(
    () => ({
      viewport,
      subscribe: (listener) => {
        scrollListeners.current.add(listener)
        return () => {
          scrollListeners.current.delete(listener)
        }
      }
    }),
    []
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader title="Prototypes" onBack={onBack} />
      <View style={styles.controls}>
        <View accessibilityRole="tablist" accessibilityLabel="Scope" style={styles.segment}>
          <ScopeButton
            label="This chat"
            selected={scope === 'chat'}
            onPress={() => setScope('chat')}
          />
          <ScopeButton
            label="All agents"
            selected={scope === 'all'}
            onPress={() => setScope('all')}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {MOBILE_PROTOTYPE_FILTERS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option }}
              hitSlop={8}
              onPress={() => setFilter(option)}
              style={[styles.chip, filter === option && styles.chipSelected]}
            >
              <Text style={[styles.chipText, filter === option && styles.chipTextSelected]}>
                {mobilePrototypeFilterLabel(option)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View ref={viewport} style={styles.listFrame}>
        <ArtifactScrollScopeContext.Provider value={tileScope}>
          <ScrollView
            contentContainerStyle={styles.list}
            scrollEventThrottle={120}
            onScroll={() => scrollListeners.current.forEach((listener) => listener())}
          >
            {rows.map((row) => (
              <PrototypeRow
                key={row.set.requestId}
                row={row}
                client={client}
                onPress={() => onOpenSet(row)}
              />
            ))}
          </ScrollView>
        </ArtifactScrollScopeContext.Provider>
      </View>
    </SafeAreaView>
  )
}

function ScopeButton({
  label,
  selected,
  onPress
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  )
}

function PrototypeRow({
  row,
  client,
  onPress
}: {
  row: PrototypeListRow
  client: ReturnType<typeof useHostClient>['client']
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={onPress}
      style={styles.row}
    >
      <MobilePrototypeTile
        client={client}
        set={row.set}
        direction={row.set.directions[0]}
        style={styles.thumbnail}
      />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {row.title}
          </Text>
          <Text style={styles.rowAge}>{row.age}</Text>
        </View>
        <View style={styles.rowAgent}>
          <Text style={styles.mono}>{prototypeAgentMono(row.set.agent)}</Text>
          <Text style={styles.rowMeta}>{mobilePrototypeAgentLabel(row.set.agent)}</Text>
        </View>
        <Text style={styles.rowStatus}>{mobilePrototypeStatusLabel(row.status)}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 6,
    gap: 10
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  segmentButton: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  segmentButtonSelected: { backgroundColor: colors.bgRaised },
  segmentText: { color: colors.textSecondary, fontSize: 14 },
  segmentTextSelected: { color: colors.textPrimary },
  chips: { gap: 6 },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipSelected: { backgroundColor: colors.textPrimary },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  chipTextSelected: { color: colors.bgBase },
  listFrame: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: spacing.lg, gap: 10 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card - 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  thumbnail: { width: 64, height: 80, borderRadius: 8 },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowTitle: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  rowAge: { color: colors.textSecondary, fontSize: typography.metaSize },
  rowAgent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mono: {
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: 10
  },
  rowMeta: { color: colors.textSecondary, fontSize: 13 },
  rowStatus: { color: colors.textPrimary, fontSize: 13 }
})
