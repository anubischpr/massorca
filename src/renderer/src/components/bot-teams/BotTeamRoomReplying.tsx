import { useCallback, useRef, useState } from 'react'
import {
  BOT_TEAM_REPLYING_POLL_MS,
  botTeamReplyingAuthor,
  newBotTeamClientRequestId
} from '../../../../shared/bot-team-typing'

/**
 * The reply a host answers in the background: who is typing, and how fast to re-read the room.
 * `expect` holds the bot a send just named until a read of the room reports what the host has.
 * A failed send keeps its request id, so sending the same text again is a retry the host posts once.
 */
export function useBotTeamReplying<TBot extends { id: string }>(bots: readonly TBot[]) {
  const [hostReplying, setHostReplying] = useState<{ botId: string }[]>([])
  const [expectedBotId, setExpectedBotId] = useState<string | null>(null)
  const retryOf = useRef<{ text: string; id: string } | null>(null)
  const inFlight = hostReplying.length > 0 || expectedBotId !== null
  const readRoom = useCallback((replying: { botId: string }[] | undefined) => {
    setHostReplying(replying ?? [])
    setExpectedBotId(null)
  }, [])
  return {
    author: botTeamReplyingAuthor(
      expectedBotId === null ? hostReplying : [{ botId: expectedBotId }],
      bots
    ),
    pollMs: inFlight ? BOT_TEAM_REPLYING_POLL_MS : null,
    requestIdFor: (text: string): string => {
      const id = retryOf.current?.text === text ? retryOf.current.id : newBotTeamClientRequestId()
      retryOf.current = { text, id }
      return id
    },
    /** The send reached the host: its id is spent, and the bot it named (if any) is typing. */
    settle: (botId: string | null) => {
      retryOf.current = null
      setExpectedBotId(botId)
    },
    readRoom
  }
}
