import { useEffect, useState } from 'react'
import { encodeNativeChatTranscriptIdentity } from '../../../src/shared/native-chat-transcript-retention'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import {
  structuredAgentSessionHostSupport,
  type StructuredAgentSessionHostSupport
} from '../session/mobile-structured-agent-session-host-support'
import { useMobileStructuredAgentSession } from '../session/use-mobile-structured-agent-session'
import { startRuntimeCapabilityProbe } from '../transport/runtime-capability-probe'
import type { RpcClient } from '../transport/rpc-client'

const NO_ERROR_REPORT = (): void => {}

/**
 * The pending question of a task's session, read and answered the way the session chat does.
 * Mount it only for a task whose session waits for the person.
 */
export function useMobileBotTeamRoomQuestion(
  client: RpcClient,
  task: BotTeamTask,
  bot: BotTeam['bots'][number],
  scope: string
): Pick<
  ReturnType<typeof useMobileStructuredAgentSession>,
  'question' | 'respondQuestion' | 'cancelPrompt'
> {
  const [hostSupport, setHostSupport] = useState<StructuredAgentSessionHostSupport | null>(null)
  useEffect(
    () =>
      startRuntimeCapabilityProbe(client, (capabilities) =>
        setHostSupport(structuredAgentSessionHostSupport(capabilities))
      ),
    [client]
  )
  const { question, respondQuestion, cancelPrompt } = useMobileStructuredAgentSession({
    client,
    sessionId: task.sessionId,
    sourceIdentity: encodeNativeChatTranscriptIdentity([scope]),
    enabled: true,
    connected: true,
    hostSupport,
    agent: bot.agent,
    onSendError: NO_ERROR_REPORT
  })
  return { question, respondQuestion, cancelPrompt }
}
