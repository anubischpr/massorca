import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentSessionModelCatalogResult } from '../../../src/shared/agent-session-wire'
import type { SessionOptionValue } from '../../../src/shared/native-chat-session-options'
import type { MobileNativeChatSessionOptionsController } from '../session/use-mobile-native-chat-session-options'
import { callAgentSession } from '../session/mobile-structured-agent-session-rpc'
import type { RpcClient } from '../transport/rpc-client'
import type { CreateSessionPicks } from './create-session-launch-plan'
import {
  applyCreateSessionModelCatalog,
  createCreateSessionOptionDraft,
  createSessionEffectiveModelId,
  createSessionOptionSnapshot,
  pickCreateSessionOption
} from './create-session-option-draft'

// The host answers a waiting read when its first listing lands, within its own 30s picker wait.
const LISTING_WAIT_TIMEOUT_MS = 45_000

async function readHostModelCatalog(
  client: RpcClient,
  agent: string
): Promise<AgentSessionModelCatalogResult> {
  const first = await callAgentSession<AgentSessionModelCatalogResult>(
    client,
    'agentSession.modelCatalog',
    { agent }
  )
  // Why: an agent's first listing runs when asked; its models arrive only on a read that waits.
  return first.origin === 'unknown' && first.listingInProgress === true
    ? callAgentSession<AgentSessionModelCatalogResult>(
        client,
        'agentSession.modelCatalog',
        { agent, waitForListing: true },
        LISTING_WAIT_TIMEOUT_MS
      )
    : first
}

export type CreateSessionOptions = {
  /** The same controller shape the chat's pickers read, backed by local draft state. */
  controller: MobileNativeChatSessionOptionsController
  picks: CreateSessionPicks
  effectiveModelId: string | null
}

/**
 * Model, effort, fast and access choices for the agent being set up. An older host refuses the
 * catalog read; the built-in list then stands and nothing here ever blocks the create.
 */
export function useCreateSessionOptions(
  client: RpcClient | null,
  agent: string | null
): CreateSessionOptions {
  const [draft, setDraft] = useState(() => createCreateSessionOptionDraft(agent))
  // Why: a new agent has its own models, so its draft starts over before paint, not in an Effect.
  if (draft.agent !== agent) {
    setDraft(createCreateSessionOptionDraft(agent))
  }
  // Why: a pick answers whether it applied right away, which a queued state updater cannot.
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (!client || !agent) {
      return
    }
    let stale = false
    const settle = (catalog: AgentSessionModelCatalogResult | null): void => {
      if (!stale) {
        setDraft((current) =>
          current.agent === agent ? applyCreateSessionModelCatalog(current, catalog) : current
        )
      }
    }
    readHostModelCatalog(client, agent).then(settle, () => settle(null))
    return () => {
      stale = true
    }
  }, [client, agent])

  const setOption = useCallback((id: string, value: SessionOptionValue): Promise<boolean> => {
    const next = pickCreateSessionOption(draftRef.current, id, value)
    if (next) {
      draftRef.current = next
      setDraft(next)
    }
    return Promise.resolve(next !== null)
  }, [])
  const invokeAction = useCallback((): Promise<boolean> => Promise.resolve(false), [])
  const recordCommand = useCallback((): void => {}, [])

  const snapshot = useMemo(() => createSessionOptionSnapshot(draft), [draft])
  const controller = useMemo<MobileNativeChatSessionOptionsController>(
    () => ({ snapshot, pendingId: null, setOption, invokeAction, recordCommand }),
    [snapshot, setOption, invokeAction, recordCommand]
  )
  return {
    controller,
    picks: draft.picks,
    effectiveModelId: createSessionEffectiveModelId(draft)
  }
}
