import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentSessionModelCatalogResult } from '../../../src/shared/agent-session-wire'
import type { SessionOptionValue } from '../../../src/shared/native-chat-session-options'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import type { MobileNativeChatSessionOptionsController } from '../session/use-mobile-native-chat-session-options'
import { callAgentSession } from '../session/mobile-structured-agent-session-rpc'
import type { RpcClient } from '../transport/rpc-client'
import type { CreateSessionPicks } from './create-session-launch-plan'
import {
  applyCreateSessionModelCatalog,
  createCreateSessionOptionDraft,
  createSessionEffectiveModelId,
  createSessionOptionSnapshot,
  createSessionReadsHostOptions,
  pickCreateSessionOption
} from './create-session-option-draft'

// The host answers a waiting read when its first listing lands, within its own 30s picker wait.
const LISTING_WAIT_TIMEOUT_MS = 45_000

async function readHostModelCatalog(
  client: RpcClient,
  agent: string,
  worktree: string | null
): Promise<AgentSessionModelCatalogResult> {
  const target = worktree ? { agent, worktree } : { agent }
  const first = await callAgentSession<AgentSessionModelCatalogResult>(
    client,
    'agentSession.modelCatalog',
    target
  )
  // Why: an agent's first listing runs when asked; its models arrive only on a read that waits.
  return first.origin === 'unknown' && first.listingInProgress === true
    ? callAgentSession<AgentSessionModelCatalogResult>(
        client,
        'agentSession.modelCatalog',
        { ...target, waitForListing: true },
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
 * Model, effort, fast and access choices for the agent being set up. A host that refuses the
 * catalog read leaves the agent's default model in place; nothing here ever blocks the create.
 */
export function useCreateSessionOptions(args: {
  client: RpcClient | null
  agent: string | null
  piRuntime: PiRuntimeSelection | null
  /** The project's main checkout, whose config the listing reads; null when none is known. */
  worktree: string | null
  /** Host and project: the listing and the picks belong to where the session will run. */
  scope: string
}): CreateSessionOptions {
  const { client, agent, piRuntime, scope, worktree } = args
  const [draft, setDraft] = useState(() => createCreateSessionOptionDraft(agent, scope, piRuntime))
  // Why: another agent, runtime, host or project has its own models and defaults, so the draft
  // starts over before paint, not in an Effect.
  if (draft.agent !== agent || draft.scope !== scope || draft.piRuntime !== piRuntime) {
    setDraft(createCreateSessionOptionDraft(agent, scope, piRuntime))
  }
  // Why: a pick answers whether it applied right away, which a queued state updater cannot.
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    // The host refuses this read for an agent the create screen does not describe.
    if (!client || !agent || !createSessionReadsHostOptions(agent)) {
      return
    }
    let stale = false
    const settle = (catalog: AgentSessionModelCatalogResult | null): void => {
      if (!stale) {
        setDraft((current) =>
          current.agent === agent && current.scope === scope
            ? applyCreateSessionModelCatalog(current, catalog)
            : current
        )
      }
    }
    readHostModelCatalog(client, agent, worktree).then(settle, () => settle(null))
    return () => {
      stale = true
    }
  }, [client, agent, scope, worktree])

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
