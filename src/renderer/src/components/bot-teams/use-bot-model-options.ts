import { useEffect, useState } from 'react'
import { botTeamHostTarget, useBotTeamHost } from '@/runtime/bot-team-host'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import type { AgentSessionModelCatalogResult } from '../../../../shared/agent-session-wire'
import {
  botModelOptions,
  botModelOptionsFromListing,
  type BotModelOption
} from '../../../../shared/bot-team-model-options'
import type { BotDraftInput } from '../../../../shared/rpc-contract/bot-team-params'

/** What a session on the team's host would offer for this agent, the list a chat's pickers read. */
export function useBotModelOptions(agent: BotDraftInput['agent']): BotModelOption[] {
  const host = useBotTeamHost()
  const [listed, setListed] = useState<{ key: string; options: BotModelOption[] } | null>(null)
  const key = `${host}:${agent}`
  useEffect(() => {
    let closed = false
    const target = botTeamHostTarget(host)
    const read = (params: object): Promise<AgentSessionModelCatalogResult> =>
      callStructuredAgentSession<AgentSessionModelCatalogResult>(
        target,
        'agentSession.modelCatalog',
        params
      )
    void (async () => {
      try {
        const first = await read({ agent })
        // An agent's first listing runs when asked; its models arrive only on a read that waits.
        const catalog =
          first.origin === 'unknown' && first.listingInProgress === true
            ? await read({ agent, waitForListing: true })
            : first
        if (!closed) {
          setListed({
            key,
            options: botModelOptionsFromListing(
              agent,
              catalog.origin === 'unknown' ? [] : catalog.models
            )
          })
        }
      } catch {
        // A host that refuses the read leaves the built-in list, or the agent's default.
      }
    })()
    return () => {
      closed = true
    }
  }, [agent, host, key])
  const fromHost = listed?.key === key ? listed.options : []
  return fromHost.length > 0 ? fromHost : botModelOptions(agent)
}
