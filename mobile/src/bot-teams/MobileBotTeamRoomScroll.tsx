import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { MobileNativeChatJumpToLatest } from '../session/MobileNativeChatJumpToLatest'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamRoomScroll } from './use-mobile-bot-team-room-scroll'

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
