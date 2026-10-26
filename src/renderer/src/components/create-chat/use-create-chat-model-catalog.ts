import { useEffect, useState } from 'react'
import type {
  AgentSessionModelCatalogResult,
  AgentSessionModelOption
} from '../../../../shared/agent-session-wire'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'

type CatalogState = { agent: TuiAgent; models: readonly AgentSessionModelOption[] }

const EMPTY_MODELS: readonly AgentSessionModelOption[] = []

/** Pre-session model and effort choices for the agents whose host catalog the renderer can read. */
export function useCreateChatModelCatalog(agent: TuiAgent): readonly AgentSessionModelOption[] {
  const [state, setState] = useState<CatalogState | null>(null)

  useEffect(() => {
    if (agent !== 'claude' && agent !== 'codex') {
      return
    }
    let cancelled = false
    void callStructuredAgentSession<AgentSessionModelCatalogResult>(
      { kind: 'local' },
      'agentSession.modelCatalog',
      { agent }
    )
      .then((result) => {
        if (!cancelled) {
          setState({ agent, models: result.origin === 'unknown' ? EMPTY_MODELS : result.models })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ agent, models: EMPTY_MODELS })
        }
      })
    return () => {
      cancelled = true
    }
  }, [agent])

  return state?.agent === agent ? state.models : EMPTY_MODELS
}
