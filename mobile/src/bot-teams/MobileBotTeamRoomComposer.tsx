import { useMemo, type ComponentProps } from 'react'
import type { BotTeamMentionProject } from '../../../src/shared/bot-team-composer-menu'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileNativeChatComposer } from '../session/MobileNativeChatComposer'
import { MobileBotTeamComposerChips } from './MobileBotTeamComposerChips'
import {
  botTeamDraftMentions,
  botTeamMentionTargets,
  removeBotTeamDraftMention
} from './mobile-bot-team-mention'

const NO_GENERATION = () => 0

/** The shared composer's props the room sets itself; the room passes the rest. */
type RoomComposerProps = Omit<
  ComponentProps<typeof MobileNativeChatComposer>,
  | 'sendSurfaceId'
  | 'getSendCompletionGeneration'
  | 'getComposerEditGeneration'
  | 'placeholder'
  | 'layout'
> & {
  team: BotTeam
  teams: readonly BotTeam[]
  projects: readonly BotTeamMentionProject[]
}

/** The room's composer: the shared one, with a pill above it for each mention the draft holds. */
export function MobileBotTeamRoomComposer({
  team,
  teams,
  projects,
  ...composer
}: RoomComposerProps) {
  const { value, onChangeText } = composer
  const targets = useMemo(
    () => botTeamMentionTargets(team, teams, projects),
    [team, teams, projects]
  )
  const mentions = useMemo(() => botTeamDraftMentions(value, targets), [value, targets])
  return (
    <>
      <MobileBotTeamComposerChips
        mentions={mentions}
        onRemove={(mention) => onChangeText(removeBotTeamDraftMention(value, mention))}
      />
      <MobileNativeChatComposer
        {...composer}
        sendSurfaceId={team.id}
        getSendCompletionGeneration={NO_GENERATION}
        getComposerEditGeneration={NO_GENERATION}
        placeholder="Message the team"
        layout="single-line"
      />
    </>
  )
}
