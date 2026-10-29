import { useCallback, useMemo, useRef, useState } from 'react'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { getRepoMainWorktreeId } from '../../../src/shared/worktree/id'
import { useNewWorkspaceExecutionTarget } from '../components/use-new-workspace-execution-target'
import { useNewWorkspaceRepositories } from '../components/use-new-workspace-repositories'
import { MOBILE_AGENT_CATALOG } from '../tasks/mobile-agent-catalog'
import { useNewWorktreeRuntimeCapabilities } from '../tasks/worktree-create-capability'
import type { RpcClient } from '../transport/rpc-client'
import {
  piRuntimeChoiceLabel,
  withAvailableCreateSessionChoice
} from './create-session-agent-choices'
import { launchBlankTerminal } from './create-session-blank'
import { buildCreateSessionLaunchPlan } from './create-session-launch-plan'
import {
  buildCreateSessionHostOptions,
  buildDefaultCreateSessionSelection,
  buildWorkspaceModeChoices,
  canSubmitCreateSession,
  chooseCreateSessionHost,
  chooseCreateSessionRepo,
  createSessionFootnote,
  effectiveWorkspaceMode,
  findSelectedRepo,
  parseWorkspaceMode,
  projectChoiceDescription,
  reposOnHost,
  showsBaseRefChip,
  workspaceModeChipLabel,
  type CreateSessionChoice,
  type CreateSessionSelection
} from './create-session-model'
import { baseRefChipLabel } from './create-session-base-ref'
import { createSessionLaunchBlocker, createSessionModeNote } from './create-session-readiness'
import { launchCreateSessionPlan } from './create-session-plan-launch'
import { useCreateSessionAgentChoices } from './use-create-session-agent-choices'
import { useCreateSessionBaseRef } from './use-create-session-base-ref'
import { useCreateSessionHostSettings } from './use-create-session-host-settings'
import { useCreateSessionLeaveLock } from './use-create-session-leave-lock'
import { useCreateSessionOptions } from './use-create-session-options'
import { useCreateSessionSetup } from './use-create-session-setup'
import { useCreateSessionSubmit, type CreateSessionLanding } from './use-create-session-submit'

const AGENT_LABELS: ReadonlyMap<TuiAgent, string> = new Map(
  MOBILE_AGENT_CATALOG.map((entry) => [entry.id, entry.label])
)

export function createSessionAgentLabel(
  agent: TuiAgent | null,
  piRuntime: PiRuntimeSelection | null = null
): string {
  if (agent === 'pi' && piRuntime !== null) {
    return piRuntimeChoiceLabel(piRuntime)
  }
  return (agent && AGENT_LABELS.get(agent)) ?? 'Agent'
}

export function useCreateSessionController(args: {
  client: RpcClient | null
  hostId: string
  onLanded: (landing: CreateSessionLanding) => void
}) {
  const { client, hostId } = args
  const {
    repos,
    selectedRepo: lastVisitedRepo,
    loading
  } = useNewWorkspaceRepositories({
    client,
    hostId,
    visible: true
  })
  const [chosen, setChosen] = useState<CreateSessionSelection | null>(null)
  const [draft, setDraft] = useState('')
  const hostSettings = useCreateSessionHostSettings(client, repos)
  const capabilities = useNewWorktreeRuntimeCapabilities(client, true)

  const initial = useMemo(
    () =>
      lastVisitedRepo
        ? buildDefaultCreateSessionSelection({ repos, lastVisitedRepoId: lastVisitedRepo.id })
        : null,
    [repos, lastVisitedRepo]
  )
  const held = chosen ?? initial
  const repo = held ? findSelectedRepo(repos, held) : null
  const executionTarget = useNewWorkspaceExecutionTarget({
    client,
    connectionId: repo?.connectionId ?? null,
    visible: true
  })
  const agentChoices = useCreateSessionAgentChoices({
    client,
    connectionId: repo?.connectionId ?? null,
    detectedAgentIds: executionTarget.detectedAgentIds,
    disabledAgents: hostSettings.disabledAgents,
    piCommand: hostSettings.piCommand
  })
  const selection = held
    ? withAvailableCreateSessionChoice(held, agentChoices, hostSettings.preferredAgent)
    : null
  const options = useCreateSessionOptions({
    client,
    agent: selection?.agent ?? null,
    piRuntime: selection?.piRuntime ?? null,
    worktree: repo ? `id:${getRepoMainWorktreeId(repo)}` : null,
    scope: `${selection?.hostId ?? ''}|${selection?.repoId ?? ''}|${selection?.piRuntime ?? ''}`
  })
  const setupState = useCreateSessionSetup(client, repo?.id ?? null)
  const baseRefShown = selection !== null && showsBaseRefChip(selection, repo)
  const baseRefSource = useCreateSessionBaseRef(client, repo?.id ?? null, baseRefShown)

  const sshReady = !executionTarget.sshGate.requiresConnection
  const hostOptions = useMemo(
    () =>
      buildCreateSessionHostOptions(repos, {
        hostLabelById: hostSettings.hostLabelById,
        hostPlatform: capabilities.hostPlatform
      }),
    [repos, hostSettings.hostLabelById, capabilities.hostPlatform]
  )
  const hostLabel = hostOptions.find((option) => option.id === selection?.hostId)?.label ?? ''
  const plan = selection
    ? buildCreateSessionLaunchPlan({
        draft,
        selection,
        repo,
        picks: options.picks,
        effectiveModelId: options.effectiveModelId
      })
    : null
  const submitState = useCreateSessionSubmit({
    onLanded: args.onLanded,
    launch: (launchPlan) => {
      if (!client || !repo) {
        return Promise.resolve({ ok: false, message: 'Not connected to the computer.' })
      }
      return launchCreateSessionPlan({
        client,
        hostId,
        repo,
        plan: launchPlan,
        setup: setupState.setup,
        agentLaunchSupport: capabilities.getAgentLaunchSupport(),
        worktreeCreateIdempotency: capabilities.getWorktreeCreateCutoverSupport()
      })
    }
  })
  const [blankBusy, setBlankBusy] = useState(false)
  const [blankError, setBlankError] = useState('')
  const blankInFlightRef = useRef(false)
  const startBlankTerminal = (): void => {
    if (
      !client ||
      !repo ||
      !selection ||
      !setupState.ready ||
      blankInFlightRef.current ||
      submitState.phase.kind === 'creating'
    ) {
      return
    }
    blankInFlightRef.current = true
    setBlankBusy(true)
    setBlankError('')
    void launchBlankTerminal({
      client,
      hostId,
      repo,
      workspaceMode: effectiveWorkspaceMode(selection, repo),
      setup: setupState.setup,
      worktreeCreateIdempotency: capabilities.getWorktreeCreateCutoverSupport()
    }).then((result) => {
      blankInFlightRef.current = false
      setBlankBusy(false)
      if (result.ok) {
        args.onLanded(result)
      } else {
        setBlankError(result.message)
      }
    })
  }
  const blocker = selection
    ? createSessionLaunchBlocker({
        support: capabilities.agentLaunch,
        workspaceMode: effectiveWorkspaceMode(selection, repo)
      })
    : null
  const busy = submitState.phase.kind === 'creating' || blankBusy
  useCreateSessionLeaveLock(busy)
  const canSubmit =
    selection !== null &&
    plan !== null &&
    blocker === null &&
    setupState.ready &&
    canSubmitCreateSession({
      draft,
      selection,
      repos,
      sshReady,
      busy
    })

  const update = useCallback(
    (change: (current: CreateSessionSelection) => CreateSessionSelection): void => {
      if (selection) {
        setChosen(change(selection))
      }
    },
    [selection]
  )
  const projectChoices: CreateSessionChoice[] = selection
    ? reposOnHost(repos, selection.hostId).map((entry) => ({
        value: entry.id,
        label: entry.displayName,
        description: projectChoiceDescription(entry)
      }))
    : []

  return {
    repos,
    loading,
    selection,
    repo,
    draft,
    setDraft,
    hostOptions,
    hostLabel,
    projectChoices,
    workspaceChoices: buildWorkspaceModeChoices(repo),
    workspaceLabel: selection ? workspaceModeChipLabel(selection, repo) : '',
    agentChoices,
    selectedAgentLabel: createSessionAgentLabel(
      selection?.agent ?? null,
      selection?.piRuntime ?? null
    ),
    footnote: selection ? createSessionFootnote(selection, repo, hostLabel) : '',
    options,
    sshGate: executionTarget.sshGate,
    connectSsh: executionTarget.connect,
    canSubmit,
    phase: submitState.phase,
    error: submitState.error || blankError,
    clearError: () => {
      submitState.clearError()
      setBlankError('')
    },
    blankBusy,
    blocker,
    setupNotice: setupState.setup.notice,
    agentsDetected: executionTarget.detectedAgentIds !== null,
    modeNote: createSessionModeNote(capabilities.agentLaunch),
    baseRefSource,
    baseRefChip: baseRefShown
      ? {
          label: baseRefChipLabel(selection?.baseRef ?? null, baseRefSource.defaultRef),
          interactive: baseRefSource.listing !== 'failed'
        }
      : null,
    chooseBaseRef: (baseRef: string | null) => update((current) => ({ ...current, baseRef })),
    startBlankTerminal,
    chooseHost: (value: string) => {
      const option = hostOptions.find((candidate) => candidate.id === value)
      if (option) {
        update((current) => chooseCreateSessionHost(current, option.id, repos))
      }
    },
    chooseProject: (repoId: string) =>
      update((current) => chooseCreateSessionRepo(current, repoId, repos)),
    chooseWorkspaceMode: (value: string) => {
      const workspaceMode = parseWorkspaceMode(value)
      if (workspaceMode) {
        update((current) => ({ ...current, workspaceMode }))
      }
    },
    chooseAgent: (value: string) => {
      const choice = agentChoices.find((candidate) => candidate.value === value)
      if (choice) {
        update((current) => ({ ...current, agent: choice.agent, piRuntime: choice.piRuntime }))
      }
    },
    submit: () => {
      if (canSubmit && plan) {
        void submitState.submit(plan)
      }
    }
  }
}

export type CreateSessionController = ReturnType<typeof useCreateSessionController>
