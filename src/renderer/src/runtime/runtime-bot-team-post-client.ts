import type { BotTeamPrototypeChoice } from '../../../shared/bot-team-prototype-choice'
import { withSenderTimeZone } from '../../../shared/bot-team-routine-zone'
import type { BotTeamRequestChoice } from '../../../shared/bot-team-request-choice'
import type { BotTeamRoomAttachment } from '../../../shared/bot-team-room-attachments'
import type { BotTeamTask } from '../../../shared/rpc-contract/bot-team-room-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { withFileNamesIfTextRequired } from './runtime-bot-team-files-only-retry'
import { callRuntimeRpc } from './runtime-rpc-client'

// Same host as every other Bot teams call; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

export async function postBotTeamRequest(input: {
  teamId: string
  text: string
  start: boolean
  /** Only this client can answer the project question, so it asks; an older client never does. */
  askProject?: boolean
  /** One id per send, reused on a retry of that send; a host from before it posts again. */
  clientRequestId?: string
  /** Files from the team folder; sent only to a host that takes them in its room. */
  attachments?: BotTeamRoomAttachment[]
  prototypeChoice?: BotTeamPrototypeChoice
}): Promise<{
  task: BotTeamTask | null
  startError: string | null
  greeted?: boolean
  /** A host from before the query's classes never sends the next two. */
  choice?: BotTeamRequestChoice
  composite?: string[]
  /** A bot answered a plain conversation in the room; nothing was filed. */
  answered?: boolean
  /** A bot is answering in the background; the room shows it typing until its line lands. */
  replying?: { botId: string }
  /** The request went to another team, because the person named it with @. */
  sentTo?: { teamId: string; teamName: string }
  /** The person asked for the work later: it waits in Todo and nothing starts. */
  later?: boolean
}> {
  const sent = withSenderTimeZone(input)
  return withFileNamesIfTextRequired(sent, (next) => call('botTeams.postMessage', next))
}
