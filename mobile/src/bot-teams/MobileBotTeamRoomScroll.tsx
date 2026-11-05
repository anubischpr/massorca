import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { MobileNativeChatJumpToLatest } from '../session/MobileNativeChatJumpToLatest'
import { MobileNativeChatMessage } from '../session/MobileNativeChatMessage'
import { isBotTeamFilesOnlyText } from '../../../src/shared/bot-team-room-attachments-line'
import { botTeamRoomTextWithFileNames } from '../../../src/shared/bot-team-room-text-paths'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { BotTeamMessage } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { useMobileBotTeamRoomScroll } from './use-mobile-bot-team-room-scroll'

/** A room message as the transcript draws it: the person's words, or a bot's reply. */
export function roomChatMessage(message: BotTeamMessage): NativeChatMessage {
  return {
    id: message.id,
    role: message.authorBotId === null ? 'user' : 'assistant',
    // A bot names a file by its path; the room attaches it, so the person reads only its name.
    blocks: [
      {
        type: 'text',
        text:
          message.authorBotId === null ? message.text : botTeamRoomTextWithFileNames(message.text)
      }
    ],
    timestamp: null,
    source: 'transcript'
  }
}

/** A message's words; a message of only files shows its chips alone. */
export function RoomMessageText({ message }: { message: BotTeamMessage }): ReactNode {
  return isBotTeamFilesOnlyText(message.text, message.attachments) ? null : (
    <MobileNativeChatMessage message={roomChatMessage(message)} />
  )
}

/** The room's transcript column: it opens and follows the latest message, and offers the way back once the reader has left it. */
export function MobileBotTeamRoomScroll({
  teamId,
  hasItems,
  children
}: {
  teamId: string
  /** Whether the room has anything to show; a remembered offset waits for it. */
  hasItems: boolean
  children: ReactNode
}) {
  const scroll = useMobileBotTeamRoomScroll({ teamId, hasItems })
  return (
    <View style={styles.grow}>
      <ScrollView
        ref={scroll.listRef}
        style={styles.grow}
        contentContainerStyle={styles.roomFeed}
        {...scroll.listScrollProps}
        onScroll={scroll.onScroll}
        onScrollBeginDrag={scroll.beginUserScroll}
        onScrollEndDrag={scroll.endUserDrag}
        onMomentumScrollBegin={scroll.beginMomentum}
        onMomentumScrollEnd={scroll.endMomentum}
        onContentSizeChange={scroll.onContentSizeChange}
        onLayout={scroll.onLayout}
      >
        {children}
      </ScrollView>
      {scroll.showJumpToTail ? <MobileNativeChatJumpToLatest onPress={scroll.jumpToTail} /> : null}
    </View>
  )
}
