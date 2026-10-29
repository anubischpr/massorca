import { useEffect, useState } from 'react'
import type {
  AgentSessionModelCatalogResult,
  AgentSessionModelOption
} from '../../../../shared/agent-session-wire'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { TuiAgent } from '../../../../shared/tui-agent'
import {
  readHostModelCatalogSnapshot,
  recordHostModelCatalogSnapshot
} from '@/runtime/host-model-catalog-snapshots'
import {
  runtimeTargetForExecutionHostId,
  type RuntimeClientTarget
} from '@/runtime/runtime-client-target'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { discoverRuntimeCommitMessageModels } from '@/runtime/runtime-git-client'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { createChatModelsFromCliListing } from './create-chat-cli-model-listing'

/** `loading`: the host has not answered; `none`: it keeps no catalog for the agent. */
export type CreateChatModelCatalog = {
  status: 'loading' | 'ready' | 'none'
  models: readonly AgentSessionModelOption[]
}

type CatalogState = { key: string } & CreateChatModelCatalog

const EMPTY_MODELS: readonly AgentSessionModelOption[] = []
const LOADING: CreateChatModelCatalog = { status: 'loading', models: EMPTY_MODELS }
const NONE: CreateChatModelCatalog = { status: 'none', models: EMPTY_MODELS }

function settled(catalog: AgentSessionModelCatalogResult | null): CreateChatModelCatalog | null {
  return catalog && catalog.origin !== 'unknown' && catalog.models.length > 0
    ? { status: 'ready', models: catalog.models }
    : null
}

async function readHostCatalog(
  target: RuntimeClientTarget,
  agent: TuiAgent
): Promise<AgentSessionModelCatalogResult> {
  const read = (waitForListing: boolean): Promise<AgentSessionModelCatalogResult> =>
    callStructuredAgentSession<AgentSessionModelCatalogResult>(
      target,
      'agentSession.modelCatalog',
      waitForListing ? { agent, waitForListing } : { agent }
    )
  const first = await read(false)
  // Why: an agent's first listing runs when asked; its models arrive only on a read that waits.
  return first.listingInProgress === true && first.origin === 'unknown' ? read(true) : first
}

async function readCliListing(
  agent: TuiAgent,
  cliContext: RuntimeGitContext | null
): Promise<CreateChatModelCatalog> {
  if (!cliContext) {
    return NONE
  }
  try {
    const models = createChatModelsFromCliListing(
      agent,
      await discoverRuntimeCommitMessageModels(cliContext, agent)
    )
    return models && models.length > 0 ? { status: 'ready', models } : NONE
  } catch {
    return NONE
  }
}

/**
 * Pre-session model and effort choices for the selected agent on the selected host: the host's
 * catalog, else the agent CLI's own listing there (what the chat composer falls back to as well).
 * An SSH host has no catalog of its own, so only its CLI listing answers.
 */
export function useCreateChatModelCatalog(
  agent: TuiAgent,
  executionHostId: ExecutionHostId,
  /** Where the CLI listing runs; keep it referentially stable, since a new one reads again. */
  cliContext: RuntimeGitContext | null
): CreateChatModelCatalog {
  const [state, setState] = useState<CatalogState | null>(null)
  const cliWorktreeId = cliContext?.worktreeId ?? null
  const key = `${executionHostId}\u0000${agent}\u0000${cliWorktreeId ?? ''}`

  useEffect(() => {
    let cancelled = false
    const publish = (catalog: CreateChatModelCatalog): void => {
      if (!cancelled) {
        setState({ key, ...catalog })
      }
    }
    const target = runtimeTargetForExecutionHostId(executionHostId)
    // Why: a saved answer renders at once; the reads below still refresh it.
    const saved = target
      ? settled(
          readHostModelCatalogSnapshot(target, agent, { newLaunch: true, seedsModel: false }) ??
            null
        )
      : null
    if (saved) {
      publish(saved)
    }
    const fromHost = target
      ? readHostCatalog(target, agent).then(
          (catalog) => {
            recordHostModelCatalogSnapshot(target, agent, null, catalog)
            return settled(catalog)
          },
          () => saved
        )
      : Promise.resolve(null)
    void fromHost
      .then((catalog) => catalog ?? readCliListing(agent, cliContext))
      .then(publish)
    return () => {
      cancelled = true
    }
  }, [key, agent, executionHostId, cliContext])

  return state?.key === key ? state : LOADING
}
