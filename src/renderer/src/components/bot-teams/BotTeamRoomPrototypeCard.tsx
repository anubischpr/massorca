import { NativeChatPrototypeCountCard } from '@/components/native-chat/NativeChatPrototypeCountCard'
import type { BotTeamRoomPrototype } from './use-bot-team-room-prototype'

/** The count question above the composer, while a prototype request waits for its answer. */
export function BotTeamRoomPrototypeCard({
  prototype
}: {
  prototype: BotTeamRoomPrototype
}): React.JSX.Element | null {
  const { ask, choose } = prototype
  if (!ask) {
    return null
  }
  return (
    <NativeChatPrototypeCountCard
      ask={{
        text: ask.text,
        attachments: [],
        sentFrom: { text: ask.text, images: [] },
        keyword: ask.keyword,
        settingAsks: ask.settingAsks,
        defaultCount: ask.defaultCount,
        agentName: ask.botName
      }}
      onChoose={choose}
    />
  )
}
