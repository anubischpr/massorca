import { useEffect, useRef, useState } from 'react'
import {
  botTeamReplyingAuthor,
  newBotTeamClientRequestId
} from '../../../src/shared/bot-team-typing'

/**
 * Who the room shows typing for a reply the host answers in the background. `expect` holds the bot
 * a send just named until the next read of the room reports what the host has. A failed send keeps its
 * request id, so sending the same text again is a retry the host posts once.
 */
export function useMobileBotTeamReplying<TBot extends { id: string }>(
  hostReplying: readonly { botId: string }[] | undefined,
  bots: readonly TBot[]
) {
  const [expectedBotId, setExpectedBotId] = useState<string | null>(null)
  const retryOf = useRef<{ text: string; id: string } | null>(null)
  useEffect(() => setExpectedBotId(null), [hostReplying])
  return {
    author: botTeamReplyingAuthor(
      expectedBotId === null ? hostReplying : [{ botId: expectedBotId }],
      bots
    ),
    requestIdFor: (text: string): string => {
      const id = retryOf.current?.text === text ? retryOf.current.id : newBotTeamClientRequestId()
      retryOf.current = { text, id }
      return id
    },
    /** The send reached the host: its id is spent, and the bot it named (if any) is typing. */
    settle: (botId: string | null) => {
      retryOf.current = null
      setExpectedBotId(botId)
    }
  }
}
