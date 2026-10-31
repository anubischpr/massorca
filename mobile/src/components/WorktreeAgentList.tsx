import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { colors, spacing } from '../theme/mobile-theme'
import { buildSessionListView, VISIBLE_SESSION_LIMIT } from '../worktree/session-status-glyph'
import { SESSION_INDENT, WorktreeAgentRow } from './WorktreeAgentRow'

type Props = {
  agents: RuntimeWorktreeAgentRow[]
  now: number
  unvisited: boolean
  /** The host cannot be reached: every session shows the unconfirmed mark instead of its state. */
  disconnected: boolean
  /** The branch each session listed here runs on, for a session that runs in another worktree. */
  runsOnBranchByPaneKey?: ReadonlyMap<string, string>
  onOpen?: (agent: RuntimeWorktreeAgentRow) => void
  onLongPress?: (agent: RuntimeWorktreeAgentRow) => void
}

// The sessions under one branch row: nested by spawn lineage, five root sessions visible, the rest
// folded behind "Show N more". Urgent sessions stay on screen even past the limit.
export function WorktreeAgentList({
  agents,
  now,
  unvisited,
  disconnected,
  runsOnBranchByPaneKey,
  onOpen,
  onLongPress
}: Props) {
  const [allShown, setAllShown] = useState(false)
  const view = useMemo(
    () => buildSessionListView({ agents, now, unvisited, disconnected, allShown }),
    [agents, now, unvisited, disconnected, allShown]
  )
  const canFold = allShown && view.rootCount > VISIBLE_SESSION_LIMIT

  return (
    <View style={styles.list}>
      {view.rows.map((row) => (
        <WorktreeAgentRow
          key={row.agent.paneKey}
          agent={row.agent}
          depth={row.depth}
          now={now}
          glyph={row.glyph}
          runsOnBranch={runsOnBranchByPaneKey?.get(row.agent.paneKey) ?? null}
          onPress={onOpen}
          onLongPress={onLongPress}
        />
      ))}
      {view.hiddenCount > 0 || canFold ? (
        <Pressable
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
          onPress={() => setAllShown((value) => !value)}
          accessibilityRole="button"
        >
          <Text style={styles.moreText}>
            {view.hiddenCount > 0 ? `Show ${view.hiddenCount} more` : 'Show less'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    marginTop: 2
  },
  more: {
    minHeight: 30,
    justifyContent: 'center',
    paddingLeft: SESSION_INDENT,
    paddingRight: spacing.xs
  },
  morePressed: {
    opacity: 0.72
  },
  moreText: {
    fontSize: 12,
    color: colors.textSecondary
  }
})
