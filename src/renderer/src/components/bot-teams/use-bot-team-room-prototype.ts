import { useCallback, useState } from 'react'
import { botAgentPiRuntime } from '../../../../shared/bot-team-character-art'
import type { BotTeamPrototypeChoice } from '../../../../shared/bot-team-prototype-choice'
import {
  sanitizePrototypeCountSetting,
  type PrototypeCountSetting
} from '../../../../shared/prototype-count-setting'
import type { PrototypeAgent } from '../../../../shared/prototype-request'
import {
  decideNativeChatPrototypeRequest,
  type NativeChatPrototypeChoice
} from '../../../../shared/prototype-request-decision'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import { useAppStore } from '@/store'

type RoomPost = (
  text: string,
  attachments: BotTeamRoomAttachment[],
  prototypeChoice?: BotTeamPrototypeChoice
) => Promise<boolean>

/** A message held for the count card: nothing is posted until the person answers. */
export type BotTeamRoomPrototypeAsk = {
  text: string
  attachments: BotTeamRoomAttachment[]
  keyword: boolean
  settingAsks: boolean
  defaultCount: number
  /** The host picks the owner later, so the card names the bot whose agent read the request as one. */
  botName: string
}

export type BotTeamRoomPrototype = {
  send: (text: string, attachments?: BotTeamRoomAttachment[]) => Promise<boolean>
  ask: BotTeamRoomPrototypeAsk | null
  choose: (choice: NativeChatPrototypeChoice) => void
}

function prototypeAgentOfBot(agent: string): PrototypeAgent {
  if (botAgentPiRuntime(agent)) {
    return 'gentle-shell'
  }
  return agent === 'claude' || agent === 'codex' || agent === 'antigravity' ? agent : 'other'
}

type RoomDecision =
  | { kind: 'as-typed' }
  | { kind: 'create'; count: number }
  | { kind: 'ask'; keyword: boolean; botName: string }

/** Any bot of the team may take the request, so the first agent whose reading asks (or applies a count) decides. */
export function decideBotTeamRoomPrototype(input: {
  text: string
  bots: BotTeam['bots']
  setting: PrototypeCountSetting
}): RoomDecision {
  let create: RoomDecision | null = null
  for (const bot of input.bots) {
    const decision = decideNativeChatPrototypeRequest({
      text: input.text,
      agent: prototypeAgentOfBot(bot.agent),
      setting: input.setting
    })
    if (decision.kind === 'ask') {
      return { kind: 'ask', keyword: decision.keyword, botName: bot.name }
    }
    create ??= decision.kind === 'create' ? decision : null
  }
  return create ?? { kind: 'as-typed' }
}

/** Gates the room's send with the "How many prototypes?" card, as Workspaces does for a chat. */
export function useBotTeamRoomPrototype({
  bots,
  post
}: {
  bots: BotTeam['bots']
  post: RoomPost
}): BotTeamRoomPrototype {
  const [ask, setAsk] = useState<BotTeamRoomPrototypeAsk | null>(null)
  const prototypeCount = useAppStore((state) => state.settings?.prototypeCount)

  const send = useCallback(
    async (text: string, attachments: BotTeamRoomAttachment[] = []): Promise<boolean> => {
      const setting = sanitizePrototypeCountSetting(prototypeCount)
      const decision = decideBotTeamRoomPrototype({ text, bots, setting })
      // A newer message retires a card still waiting for its answer.
      setAsk(null)
      if (decision.kind === 'ask') {
        setAsk({
          text,
          attachments,
          keyword: decision.keyword,
          settingAsks: setting.mode === 'ask',
          defaultCount: setting.count,
          botName: decision.botName
        })
        return true
      }
      return post(
        text,
        attachments,
        decision.kind === 'create' ? { count: decision.count } : undefined
      )
    },
    [bots, post, prototypeCount]
  )

  const choose = useCallback(
    (choice: NativeChatPrototypeChoice): void => {
      if (!ask) {
        return
      }
      setAsk(null)
      void post(ask.text, ask.attachments, choice === 'as-typed' ? undefined : choice).then(
        (sent) => {
          // A refused post brings the card back, so the message is not lost.
          if (!sent) {
            setAsk(ask)
          }
        }
      )
    },
    [ask, post]
  )

  return { send, ask, choose }
}
