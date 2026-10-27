import { useEffect, useState } from 'react'
import type {
  AgentSessionModelCatalogResult,
  AgentSessionModelOption
} from '../../../../shared/agent-session-wire'
import type { TuiAgent } from '../../../../shared/tui-agent'
import {
  readHostModelCatalogSnapshot,
  recordHostModelCatalogSnapshot
} from '@/runtime/host-model-catalog-snapshots'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'

/** `loading`: the host has not answered; `none`: it keeps no catalog for the agent. */
export type CreateChatModelCatalog = {
  status: 'loading' | 'ready' | 'none'
  models: readonly AgentSessionModelOption[]
}

type CatalogState = { agent: TuiAgent } & CreateChatModelCatalog

const LOCAL_HOST: RuntimeClientTarget = { kind: 'local' }
const EMPTY_MODELS: readonly AgentSessionModelOption[] = []
const LOADING: CreateChatModelCatalog = { status: 'loading', models: EMPTY_MODELS }

function settled(catalog: AgentSessionModelCatalogResult | null): CreateChatModelCatalog {
  return catalog && catalog.origin !== 'unknown' && catalog.models.length > 0
    ? { status: 'ready', models: catalog.models }
    : { status: 'none', models: EMPTY_MODELS }
}

/** Pre-session model and effort choices from the host catalog, for whichever agent is selected. */
export function useCreateChatModelCatalog(agent: TuiAgent): CreateChatModelCatalog {
  const [state, setState] = useState<CatalogState | null>(null)

  useEffect(() => {
    let cancelled = false
    const settle = (catalog: AgentSessionModelCatalogResult | null): void => {
      if (cancelled) {
        return
      }
      if (catalog) {
        recordHostModelCatalogSnapshot(LOCAL_HOST, agent, null, catalog)
      }
      setState({ agent, ...settled(catalog) })
    }
    const read = (waitForListing: boolean): Promise<AgentSessionModelCatalogResult> =>
      callStructuredAgentSession<AgentSessionModelCatalogResult>(
        LOCAL_HOST,
        'agentSession.modelCatalog',
        waitForListing ? { agent, waitForListing } : { agent }
      )
    // Why: a saved answer renders at once; the read below still refreshes it.
    const saved = readHostModelCatalogSnapshot(LOCAL_HOST, agent, {
      newLaunch: true,
      seedsModel: false
    })
    if (saved) {
      setState({ agent, ...settled(saved) })
    }
    void read(false)
      .then((first) => {
        // Why: an agent's first listing runs when asked; its models arrive only on a read that waits.
        if (first.listingInProgress === true && first.origin === 'unknown') {
          return read(true)
        }
        return first
      })
      .then(settle, () => {
        if (!saved) {
          settle(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [agent])

  return state?.agent === agent ? state : LOADING
}
