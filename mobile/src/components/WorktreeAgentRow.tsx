import { memo } from 'react'
import { GitBranch } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { BotTeamSessionTeamsResult } from '../../../src/shared/rpc-contract/bot-team-session-team-params'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { withoutNativeChatVisualDirectiveLines } from '../../../src/shared/native-chat-visual-directive'
import { colors, spacing } from '../theme/mobile-theme'
import { agentDisplayLabel } from '../worktree/agent-row-display'
import type { SessionStatusGlyph } from '../worktree/session-status-glyph'
import { MobileBotTeamSessionCharacter } from '../bot-teams/MobileBotTeamSessionCharacter'
import { MobileAgentIcon } from './MobileAgentIcon'
import { SessionStatusMark } from './SessionStatusMark'
import { mobilePiRuntimeFromMarker } from './mobile-pi-runtime'

// Lead column width plus gap: a session's icon sits under the branch row's label, one step in.
export const SESSION_INDENT = 36
export const SESSION_INDENT_PER_DEPTH = 18

type Props = {
  agent: RuntimeWorktreeAgentRow
  depth: number
  now: number
  glyph: SessionStatusGlyph | null
  /** The branch this session runs on, when it runs in another worktree than the one it is listed in. */
  runsOnBranch?: string | null
  /** The bot team that started this session, shown after its name; absent for any other session. */
  botTeam?: BotTeamSessionTeamsResult['sessionTeams'][string]
  onPress?: (agent: RuntimeWorktreeAgentRow) => void
  onLongPress?: (agent: RuntimeWorktreeAgentRow) => void
}

// One session line: agent identity, title, trailing status. The model and the time are not shown.
function WorktreeAgentRowComponent({
  agent,
  depth,
  now,
  glyph,
  runsOnBranch,
  botTeam,
  onPress,
  onLongPress
}: Props) {
  // A visual line renders only in the transcript; the row shows the words around it, and a reply
  // that is only a visual falls back like an empty one.
  const reply = agent.lastAssistantMessage
  const label = agentDisplayLabel(
    reply
      ? { ...agent, lastAssistantMessage: withoutNativeChatVisualDirectiveLines(reply) }
      : agent,
    now
  )
  const indent = SESSION_INDENT + depth * SESSION_INDENT_PER_DEPTH
  const emphasis =
    glyph === 'unread' ? styles.labelUnread : glyph === 'needs-human' ? styles.labelLoud : null

  return (
    <Pressable
      style={({ pressed }) => [styles.row, { paddingLeft: indent }, pressed && styles.rowPressed]}
      onPress={onPress ? () => onPress(agent) : undefined}
      onLongPress={onLongPress ? () => onLongPress(agent) : undefined}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={runsOnBranch ? `${label}, runs on branch ${runsOnBranch}` : label}
    >
      {depth > 0 ? <View style={[styles.rule, { left: indent - 10 }]} /> : null}
      {agent.agentType ? (
        <MobileAgentIcon
          agentId={agent.agentType}
          size={14}
          piRuntime={mobilePiRuntimeFromMarker(agent)}
        />
      ) : (
        <View style={styles.iconSpacer} />
      )}
      {/* Why: a session listed under a parent in another worktree names the branch it runs on. */}
      {runsOnBranch ? (
        <View
          accessible
          accessibilityLabel={`Runs on branch ${runsOnBranch}`}
          style={styles.branchMark}
        >
          <GitBranch size={12} color={colors.textMuted} />
        </View>
      ) : null}
      <View style={styles.labelRow}>
        <Text style={[styles.label, emphasis]} numberOfLines={1}>
          {label}
        </Text>
        <MobileBotTeamSessionCharacter sessionTeam={botTeam} />
      </View>
      <SessionStatusMark glyph={glyph} />
    </Pressable>
  )
}

export const WorktreeAgentRow = memo(WorktreeAgentRowComponent)

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 30,
    paddingRight: spacing.xs
  },
  rowPressed: {
    backgroundColor: colors.bgRaised
  },
  rule: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.borderSubtle
  },
  iconSpacer: {
    width: 14
  },
  branchMark: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  // Why: the name and the team mark share one line; the name truncates so the mark stays after it.
  labelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    color: colors.textSecondary
  },
  labelUnread: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  labelLoud: {
    color: colors.textPrimary
  }
})
