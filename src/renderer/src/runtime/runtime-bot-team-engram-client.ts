import type { BotTeamEngramReply } from '../../../shared/rpc-contract/bot-team-engram-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'

/** A host from before this method answers 'unavailable', the same line as a host without Engram. */
export async function listBotTeamEngramMemory(input: {
  teamId: string
  projectId: string
  query?: string
}): Promise<BotTeamEngramReply> {
  try {
    return await callRuntimeRpc<BotTeamEngramReply>(
      botTeamHostTarget(currentBotTeamHost()),
      'botTeams.listEngramMemory',
      input
    )
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return { status: 'unavailable', memories: [] }
    }
    throw error
  }
}
