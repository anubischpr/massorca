// `agentSession.providerCommand` — run one command the provider answers for its chat.
//
// Additive: an older host answers `method_not_found`, and a client offers a command only where
// `agentSession.options` reported it in `providerCommands`, so it never reaches a host without this.

import { defineMethod } from '../core'
import {
  requireStructuredSessionHost as requireSessionHost,
  structuredCallerFor as callerFor
} from './structured-agent-session-gate'
import { ProviderCommandParams } from './structured-agent-session-schemas'

export const STRUCTURED_AGENT_SESSION_PROVIDER_COMMAND_METHODS = [
  defineMethod({
    name: 'agentSession.providerCommand',
    permission: 'workspace',
    params: ProviderCommandParams,
    handler: async (params, ctx) =>
      requireSessionHost(ctx, params.envelope.sessionId).mutations.runProviderCommand(
        callerFor(ctx),
        params
      )
  })
]
