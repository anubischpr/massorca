import type { ComponentProps } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { resolveBottomDrawerKeyboardInset } from '../components/bottom-drawer-keyboard-inset'
import { hostOs } from '../platform/host-os'
import { useKeyboardOcclusion } from '../platform/keyboard-occlusion'
import { useOpenMobilePrototypeSet } from '../prototypes/use-open-mobile-prototype-set'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
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
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardOcclusion()
  // Why: the chat screen's keyboard lift, so the room's composer rests on the keyboard, not under it.
  const keyboardInset = resolveBottomDrawerKeyboardInset({
    keyboardHeight,
    bottomInset: insets.bottom,
    fillAvailable: false,
    platform: hostOs()
  })
  return (
    <BotTeamRoomPrototypeOpenContext.Provider value={openPrototypeSet}>
      <View style={[styles.grow, { paddingBottom: keyboardInset }]}>
        <MobileBotTeamRoom {...props} workingOf={(teamId) => statusOf(teamId) === 'Working'} />
      </View>
    </BotTeamRoomPrototypeOpenContext.Provider>
  )
}
