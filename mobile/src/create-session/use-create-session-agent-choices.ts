import { useMemo } from 'react'
import { MOBILE_AGENT_CATALOG } from '../tasks/mobile-agent-catalog'
import { isMobileTuiAgentEnabled } from '../tasks/mobile-tui-agents'
import type { RpcClient } from '../transport/rpc-client'
import {
  buildCreateSessionAgentChoices,
  type CreateSessionAgentChoice
} from './create-session-agent-choices'
import { useCreateSessionPiRuntimes } from './use-create-session-pi-runtimes'

/** The agent sheet's rows for a repo's host: the agents it found, with Pi split by the runtimes it reports. */
export function useCreateSessionAgentChoices(args: {
  client: RpcClient | null
  connectionId: string | null
  detectedAgentIds: ReadonlySet<string> | null
  disabledAgents: unknown
  piCommand: string | undefined
}): CreateSessionAgentChoice[] {
  const { client, connectionId, detectedAgentIds, disabledAgents, piCommand } = args
  // Asked once agent detection has found Pi on this host, so a host without Pi is never asked.
  const piRuntimes = useCreateSessionPiRuntimes({
    client,
    connectionId,
    enabled: detectedAgentIds?.has('pi') === true
  })
  return useMemo(
    () =>
      buildCreateSessionAgentChoices({
        catalog: MOBILE_AGENT_CATALOG,
        detectedAgentIds,
        isEnabled: (agent) => isMobileTuiAgentEnabled(agent, disabledAgents),
        piRuntimes,
        piCommand
      }),
    [detectedAgentIds, disabledAgents, piCommand, piRuntimes]
  )
}
