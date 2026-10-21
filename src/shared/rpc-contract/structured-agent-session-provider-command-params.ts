import { z } from 'zod'
import {
  AGENT_SESSION_PROVIDER_COMMANDS,
  AGENT_SESSION_PROVIDER_COMMAND_ARGUMENT_MAX_LENGTH
} from '../agent-session-provider-command'
import { MutationEnvelope } from './structured-agent-session-mutation-params'

export const ProviderCommandParams = z
  .object({
    envelope: MutationEnvelope,
    command: z.enum(AGENT_SESSION_PROVIDER_COMMANDS),
    argument: z.string().max(AGENT_SESSION_PROVIDER_COMMAND_ARGUMENT_MAX_LENGTH).optional()
  })
  .strict()
