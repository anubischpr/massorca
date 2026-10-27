import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { useDetectedAgents, type AgentDetectionTarget } from '@/hooks/useDetectedAgents'
import { resolveHostCapabilities } from '@/lib/agent-launch-route-input'
import { getSettingsForWorktreeRuntimeOwner } from '@/lib/worktree-runtime-owner'
import type { PiDisplayRuntime } from '@/lib/pi-agent-display'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import {
  readHostStructuredAgents,
  relearnHostStructuredAgents,
  subscribeHostStructuredAgents
} from '@/runtime/host-structured-agents'
import type { RuntimeGitContext } from '@/runtime/runtime-git-client-context'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { DEFAULT_DISABLED_TUI_AGENTS } from '../../../../shared/tui-agent-selection'
import { getRepoMainWorktreeId } from '../../../../shared/worktree/id'
import { createChatAgentsForHost } from './create-chat-agent-availability'
import { reposOnHost, type CreateChatRepoOption, type CreateChatSelection } from './create-chat-selection'

export type CreateChatAgents = {
  /** Chat-capable agents on the selected host, in launch order. Empty until detection lands. */
  agents: readonly TuiAgent[]
  piRuntime: PiDisplayRuntime
  /** Where the selected host lists an agent CLI's models; null when no workspace there can run it. */
  modelListingContext: RuntimeGitContext | null
}

function detectionTargetFor(executionHostId: ExecutionHostId): AgentDetectionTarget {
  const host = parseExecutionHostId(executionHostId)
  if (host?.kind === 'ssh') {
    return { kind: 'ssh', connectionId: host.targetId }
  }
  if (host?.kind === 'runtime') {
    return { kind: 'runtime', environmentId: host.environmentId }
  }
  return { kind: 'local' }
}

type HostProbeWorkspace = { worktreeId: string; path: string }

/** A workspace on the host to ask about it: the picked project's checkout, else any on the host. */
function hostProbeWorkspace(
  selection: CreateChatSelection,
  repos: readonly CreateChatRepoOption[],
  worktreesByRepo: ReturnType<typeof useAppStore.getState>['worktreesByRepo']
): HostProbeWorkspace | null {
  const { project } = selection
  const picked =
    project.kind === 'repo' ? repos.find((repo) => repo.repoId === project.repoId) : undefined
  const repo = picked ?? reposOnHost(repos, selection.executionHostId)[0]
  if (!repo) {
    return null
  }
  const main = worktreesByRepo[repo.repoId]?.find((worktree) => worktree.isMainWorktree)
  return {
    worktreeId: main?.id ?? getRepoMainWorktreeId({ id: repo.repoId, path: repo.path }),
    path: main?.path ?? repo.path
  }
}

function modelListingContextFor(
  executionHostId: ExecutionHostId,
  probe: HostProbeWorkspace | null,
  settings: RuntimeGitContext['settings']
): RuntimeGitContext | null {
  const host = parseExecutionHostId(executionHostId)
  if (!probe) {
    // A projectless chat runs on this computer, which lists without a workspace.
    return host?.kind === 'local'
      ? { settings, worktreeId: null, worktreePath: '' }
      : null
  }
  return {
    settings: getSettingsForWorktreeRuntimeOwner(useAppStore.getState(), probe.worktreeId),
    worktreeId: probe.worktreeId,
    worktreePath: probe.path,
    ...(host?.kind === 'ssh' ? { connectionId: host.targetId } : {})
  }
}

/** The agents create-chat offers on the selected host, with the Pi runtime it names. */
export function useCreateChatAgents(
  selection: CreateChatSelection,
  repos: readonly CreateChatRepoOption[]
): CreateChatAgents {
  const { executionHostId } = selection
  const settings = useAppStore((s) => s.settings)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  const detectionTarget = useMemo(() => detectionTargetFor(executionHostId), [executionHostId])
  const { detectedIds } = useDetectedAgents(detectionTarget)
  const probe = hostProbeWorkspace(selection, repos, worktreesByRepo)
  const probeWorktreeId = probe?.worktreeId ?? ''
  const probePath = probe?.path ?? ''
  // Why: Gentle Shell is off PATH; the host's own Pi answer (or a Pi command) is what names it.
  const piRuntime = usePiDisplayRuntime({ worktreeId: probeWorktreeId })
  const modelListingContext = useMemo(
    () =>
      modelListingContextFor(
        executionHostId,
        probeWorktreeId ? { worktreeId: probeWorktreeId, path: probePath } : null,
        settings
      ),
    [executionHostId, probeWorktreeId, probePath, settings]
  )
  const hostAgents = useSyncExternalStore(
    subscribeHostStructuredAgents,
    () => readHostStructuredAgents(executionHostId, runtimeStatusByEnvironmentId),
    () => readHostStructuredAgents(executionHostId, runtimeStatusByEnvironmentId)
  )

  useEffect(() => {
    void relearnHostStructuredAgents(
      executionHostId,
      resolveHostCapabilities({ runtimeStatusByEnvironmentId }, executionHostId),
      runtimeStatusByEnvironmentId
    )
  }, [executionHostId, runtimeStatusByEnvironmentId])

  const agents = useMemo(
    () =>
      createChatAgentsForHost({
        detected: detectedIds,
        piAvailable: piRuntime !== 'unknown',
        hostStructuredAgents: hostAgents?.map((row) => row.agent),
        defaultAgent: settings?.defaultTuiAgent,
        disabled: settings?.disabledTuiAgents ?? DEFAULT_DISABLED_TUI_AGENTS
      }),
    [detectedIds, piRuntime, hostAgents, settings?.defaultTuiAgent, settings?.disabledTuiAgents]
  )
  return { agents, piRuntime, modelListingContext }
}
