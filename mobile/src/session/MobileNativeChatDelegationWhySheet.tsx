import { Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import type { DelegationCardPayload } from '../../../src/shared/delegated-session-journal'
import type { DelegationDecision } from '../../../src/shared/delegated-session-types'
import { BottomDrawer } from '../components/BottomDrawer'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  automaticWhyHeading,
  delegationDimensionCells,
  delegationModelLines,
  delegationPlacementLines,
  delegationPlacementText,
  delegationRankRows,
  delegationTaskLines,
  delegationWinnerLines,
  modelEffortText,
  type MobileDelegationRankRow
} from './mobile-delegation-card-model'

/** Why Automatic picked its agent: the ranking by usage, the task's tier and dimensions, and the result. */
export function MobileNativeChatDelegationWhySheet({
  visible,
  onClose,
  card,
  decision
}: {
  visible: boolean
  onClose: () => void
  card: DelegationCardPayload
  decision: DelegationDecision
}): React.JSX.Element {
  const rankRows = delegationRankRows(card, decision)
  const winnerLines = delegationWinnerLines(decision)
  const taskLines = delegationTaskLines(decision)
  const modelLines = delegationModelLines(decision)
  return (
    <BottomDrawer visible={visible} onClose={onClose} dragContentToDismiss>
      <View style={styles.header}>
        <Text style={styles.title}>{automaticWhyHeading(card, decision.agent)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={spacing.sm}
          style={styles.close}
          onPress={onClose}
        >
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <SheetSectionLabel label="1 · Agent: lowest usage" />
      <View style={styles.group}>
        {rankRows.map((row, index) => (
          <RankRow key={row.agentId} row={row} first={index === 0} />
        ))}
      </View>
      {winnerLines.map((line) => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}
      <Text style={styles.note}>
        Each agent counts its tighter window. Agents at 90% or more are skipped.
      </Text>

      <SheetSectionLabel label={`2 · Task: tier ${decision.tier} of 5`} />
      <View style={styles.cells}>
        {delegationDimensionCells(decision.dimensions).map((cell) => (
          <View key={cell.title} style={styles.cell}>
            <Text style={styles.cellTitle}>{cell.title}</Text>
            <Text style={styles.cellValue}>{cell.value}</Text>
          </View>
        ))}
      </View>
      {taskLines.map((line) => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}

      <SheetSectionLabel label="3 · Result" />
      <View style={styles.fact}>
        <Text style={styles.factTitle}>Model · effort</Text>
        <Text style={styles.factValueMono}>{modelEffortText(decision.model, decision.effort)}</Text>
      </View>
      {modelLines.map((line) => (
        <Text key={line} style={styles.factNote}>
          {line}
        </Text>
      ))}
      <View style={styles.fact}>
        <Text style={styles.factTitle}>Runs in</Text>
        <Text style={styles.factValue}>{delegationPlacementText(decision.placement)}</Text>
      </View>
      {delegationPlacementLines(decision.placement, decision.placementWarning).map((line) => (
        <Text key={line} style={styles.factNote}>
          {line}
        </Text>
      ))}
    </BottomDrawer>
  )
}

function RankRow({ row, first }: { row: MobileDelegationRankRow; first: boolean }) {
  return (
    <View style={[styles.rank, !first && styles.rankDivider, row.picked && styles.rankPicked]}>
      <Text style={styles.rankLabel}>{row.label}</Text>
      <View style={styles.rankValues}>
        <Text style={[styles.rankValue, row.excluded && styles.rankExcluded]}>{row.valueText}</Text>
        {row.windowText ? <Text style={styles.rankWindow}>{row.windowText}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600'
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  group: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden'
  },
  rank: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  rankDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle
  },
  rankPicked: {
    backgroundColor: colors.bgRaised
  },
  rankLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  rankValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs
  },
  rankValue: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  rankExcluded: {
    color: colors.statusRed
  },
  rankWindow: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  note: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  cell: {
    width: '48%',
    gap: 2,
    padding: spacing.sm,
    borderRadius: radii.row,
    backgroundColor: colors.bgRaised
  },
  cellTitle: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  cellValue: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm
  },
  factTitle: {
    color: colors.textSecondary,
    fontSize: typography.bodySize
  },
  factValue: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    textAlign: 'right'
  },
  factValueMono: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    textAlign: 'right'
  },
  factNote: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
    textAlign: 'right'
  }
})
