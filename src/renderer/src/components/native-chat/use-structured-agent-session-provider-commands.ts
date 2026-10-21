import { useCallback, useRef, useState } from 'react'
import type {
  AgentSessionProviderCommand,
  AgentSessionProviderCommandResult
} from '../../../../shared/agent-session-provider-command'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

const NO_COMMANDS: readonly AgentSessionProviderCommand[] = []

export type StructuredAgentSessionProviderCommands = {
  /** The commands the host reported this session can run now. */
  available: readonly AgentSessionProviderCommand[]
  pending: boolean
  /** Null when the command was refused or not sent; the error surfaces separately. */
  run: (
    command: AgentSessionProviderCommand,
    argument?: string
  ) => Promise<AgentSessionProviderCommandResult | null>
}

/** Provider commands run one at a time: a second press while one is out is not sent. */
export function useStructuredAgentSessionProviderCommands(args: {
  available: readonly AgentSessionProviderCommand[] | undefined
  mutate: StructuredAgentSessionMutate
}): StructuredAgentSessionProviderCommands {
  const { mutate } = args
  const available = args.available ?? NO_COMMANDS
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const run = useCallback(
    async (command: AgentSessionProviderCommand, argument?: string) => {
      if (pendingRef.current) {
        return null
      }
      pendingRef.current = true
      setPending(true)
      try {
        return await mutate<AgentSessionProviderCommandResult>(
          'agentSession.providerCommand',
          'agentSession.providerCommand',
          { command, ...(argument === undefined ? {} : { argument }) }
        )
      } finally {
        pendingRef.current = false
        setPending(false)
      }
    },
    [mutate]
  )
  return { available, pending, run }
}
