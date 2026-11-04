import { Fragment, useCallback, useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { splitBotTeamMentionText } from '../../../src/shared/bot-team-mention-text'
import { MobileFileTypeIcon } from '../components/MobileFileTypeIcon'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { colors, radii } from '../theme/mobile-theme'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamMentionProject } from '../../../src/shared/bot-team-composer-menu'
import { botTeamMentionTargets, type MobileBotTeamMentionTarget } from './mobile-bot-team-mention'

/** The icon a bot, team or project chip shows; null when it has none (a project without a logo). */
export function targetIcon(target: MobileBotTeamMentionTarget): ReactNode {
  if (target.kind === 'bot' && target.agent !== null) {
    return <MobileBotAgentIcon agentId={target.agent} size={12} />
  }
  if (target.kind === 'team' && target.character !== null) {
    return <MobileBotTeamCharacterIcon character={target.character} size={12} />
  }
  if (target.kind === 'project' && target.logo) {
    return <MobileRepoIcon repoIcon={target.logo} size={12} />
  }
  return null
}

/**
 * The room's plain-text runs with each known `@Name` and each `@path.ext` drawn as a chip; null
 * when the run has none, so the run stays as it was. Unknown names stay plain text.
 */
export function botTeamMentionNodes(
  text: string,
  keyPrefix: string,
  targets: readonly MobileBotTeamMentionTarget[]
): ReactNode[] | null {
  const segments = splitBotTeamMentionText(text, targets, { files: true })
  if (!segments.some((segment) => segment.kind !== 'text')) {
    return null
  }
  return segments.map((segment, index) => {
    const key = `${keyPrefix}:${index}`
    if (segment.kind === 'file') {
      // The chip shows the path alone; the message text keeps its "@".
      return (
        <BotTeamMentionChip
          key={key}
          icon={<MobileFileTypeIcon path={segment.path} size={12} />}
          label={segment.path}
        />
      )
    }
    const target =
      segment.kind === 'mention' ? targets.find((entry) => entry.name === segment.name) : undefined
    if (segment.kind === 'text' || target === undefined) {
      return <Fragment key={key}>{segment.value}</Fragment>
    }
    // The chip shows the name alone; the message text keeps its "@Name".
    return <BotTeamMentionChip key={key} icon={targetIcon(target)} label={target.name} />
  })
}

/** The room's mention renderer for its messages, over the bots, other teams and projects it can name. */
export function useBotTeamMentionRenderer(
  team: BotTeam,
  teams: readonly BotTeam[],
  projects: readonly BotTeamMentionProject[]
) {
  const targets = useMemo(
    () => botTeamMentionTargets(team, teams, projects),
    [team, teams, projects]
  )
  return useCallback(
    (text: string, keyPrefix: string) => botTeamMentionNodes(text, keyPrefix, targets),
    [targets]
  )
}

/** A mention inside a message: its icon, then its label, in the message's own line. */
export function BotTeamMentionChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Text style={styles.chip}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
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
