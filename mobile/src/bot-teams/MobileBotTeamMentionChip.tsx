import { Fragment, useCallback, useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { splitBotTeamMentionText } from '../../../src/shared/bot-team-mention-text'
import { colors, radii } from '../theme/mobile-theme'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { botTeamMentionTargets, type MobileBotTeamMentionTarget } from './mobile-bot-team-mention'

/**
 * The room's plain-text runs with each known `@Name` drawn as a chip; null when the run has none,
 * so the run stays as it was. Unknown names stay plain text.
 */
export function botTeamMentionNodes(
  text: string,
  keyPrefix: string,
  targets: readonly MobileBotTeamMentionTarget[]
): ReactNode[] | null {
  const segments = splitBotTeamMentionText(text, targets)
  if (!segments.some((segment) => segment.kind === 'mention')) {
    return null
  }
  return segments.map((segment, index) => {
    const key = `${keyPrefix}:${index}`
    const target =
      segment.kind === 'mention' ? targets.find((entry) => entry.name === segment.name) : undefined
    if (segment.kind === 'text' || target === undefined) {
      return <Fragment key={key}>{segment.value}</Fragment>
    }
    // The chip shows the name alone; the message text keeps its "@Name".
    return <BotTeamMentionChip key={key} target={target} label={target.name} />
  })
}

/** The room's mention renderer for its messages, over the bots and other teams it can name. */
export function useBotTeamMentionRenderer(team: BotTeam, teams: readonly BotTeam[]) {
  const targets = useMemo(() => botTeamMentionTargets(team, teams), [team, teams])
  return useCallback(
    (text: string, keyPrefix: string) => botTeamMentionNodes(text, keyPrefix, targets),
    [targets]
  )
}

/** A bot or team mention inside a message: its icon, then its name, in the message's own line. */
export function BotTeamMentionChip({
  target,
  label
}: {
  target: MobileBotTeamMentionTarget
  label: string
}) {
  return (
    <Text style={styles.chip}>
      <View style={styles.icon}>
        {target.kind === 'bot' && target.agent !== null ? (
          <MobileBotAgentIcon agentId={target.agent} size={12} />
        ) : null}
        {target.kind === 'team' && target.character !== null ? (
          <MobileBotTeamCharacterIcon character={target.character} size={12} />
        ) : null}
      </View>
      {label}
    </Text>
  )
}

const styles = StyleSheet.create({
  chip: {
    color: colors.textPrimary,
    fontWeight: '600',
    backgroundColor: colors.bgRaised,
    borderRadius: radii.button,
    overflow: 'hidden'
  },
  icon: {
    width: 12,
    height: 12,
    marginRight: 3,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
