import type { ComponentProps } from 'react'
import { useOpenMobilePrototypeSet } from '../prototypes/use-open-mobile-prototype-set'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'
import { BotTeamRoomPrototypeOpenContext } from './MobileBotTeamRoomPrototypeLinks'
import { useMobileBotTeamStatus } from './use-mobile-bot-team-status'

/**
 * The Conference room with its team's real state, read the same way the carousel reads it, and with
 * bot reports opening their tasks' Prototypes sets on this host.
 */
export function MobileBotTeamConferenceRoom({
  hostId,
  ...props
}: Omit<ComponentProps<typeof MobileBotTeamRoom>, 'workingOf'> & { hostId: string }) {
  const statusOf = useMobileBotTeamStatus(props.client, props.teams)
  const openPrototypeSet = useOpenMobilePrototypeSet(hostId)
  return (
    <BotTeamRoomPrototypeOpenContext.Provider value={openPrototypeSet}>
      <MobileBotTeamRoom {...props} workingOf={(teamId) => statusOf(teamId) === 'Working'} />
    </BotTeamRoomPrototypeOpenContext.Provider>
  )
}
