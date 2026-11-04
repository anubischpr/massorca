import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import type { AgentSessionRecordStore } from '../runtime/agent-session-record-store'
import {
  botRunEnvKeysToDelete,
  claudeBotRunDisallowedTools,
  deleteBotRunDeniedEnv,
  resolveBotRunDenial
} from '../marketplace/marketplace-bot-run-denial'
import type { ClaudeStructuredLaunch } from './claude-structured-launch-resolution'

type ResolveClaudeLaunch = (input: {
  identity: AgentSessionJournalIdentity
}) => Promise<ClaudeStructuredLaunch>

/**
 * A bot run's Claude launch without the Marketplace apps its bot is kept out of: their tokens are
 * gone from the env (also from what the child would inherit from Orca) and every tool of their MCP
 * servers is denied. Any other session's launch is returned untouched.
 */
export function withClaudeBotRunDenial(
  resolve: ResolveClaudeLaunch,
  deps: {
    store: Pick<AgentSessionRecordStore, 'getRecord'>
    resolveBotRunDenial?: typeof resolveBotRunDenial
  }
): ResolveClaudeLaunch {
  return async (input) => {
    const launch = await resolve(input)
    const denial = await (deps.resolveBotRunDenial ?? resolveBotRunDenial)(
      deps.store.getRecord(input.identity.sessionId)?.options
    )
    if (!denial) {
      return launch
    }
    const disallowedTools = claudeBotRunDisallowedTools(denial)
    // Why: a variable, not a literal: `disallowedTools` is an SDK option this launch type does not list.
    const options =
      disallowedTools.length > 0 ? { ...launch.options, disallowedTools } : launch.options
    return {
      ...launch,
      options,
      ...(launch.env ? { env: deleteBotRunDeniedEnv({ ...launch.env }, denial) } : {}),
      envToDelete: botRunEnvKeysToDelete(denial)
    }
  }
}
