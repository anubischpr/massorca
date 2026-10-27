import { useCallback, useMemo, useRef, useState } from 'react'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { useNewWorkspaceExecutionTarget } from '../components/use-new-workspace-execution-target'
import { useNewWorkspaceRepositories } from '../components/use-new-workspace-repositories'
import { MOBILE_AGENT_CATALOG } from '../tasks/mobile-agent-catalog'
import { isMobileTuiAgentEnabled } from '../tasks/mobile-tui-agents'
import { useNewWorktreeRuntimeCapabilities } from '../tasks/worktree-create-capability'
import type { RpcClient } from '../transport/rpc-client'
import { launchBlankTerminal } from './create-session-blank'
import { launchCreateSession } from './create-session-launch'
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
  selectableCreateSessionAgents,
  withAvailableCreateSessionAgent,
  workspaceModeChipLabel,
  type CreateSessionChoice,
  type CreateSessionSelection
} from './create-session-model'
import { useCreateSessionHostSettings } from './use-create-session-host-settings'
import { useCreateSessionOptions } from './use-create-session-options'
import { useCreateSessionSubmit, type CreateSessionLanding } from './use-create-session-submit'

const AGENT_LABELS: ReadonlyMap<TuiAgent, string> = new Map(
  MOBILE_AGENT_CATALOG.map((entry) => [entry.id, entry.label])
)

export function createSessionAgentLabel(agent: TuiAgent | null): string {
  return (agent && AGENT_LABELS.get(agent)) ?? 'Agent'
}

/** Everything the create screen reads and does, so the view is only layout. */
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
  const agents = useMemo(
    () =>
      selectableCreateSessionAgents(MOBILE_AGENT_CATALOG, {
        detectedAgentIds: executionTarget.detectedAgentIds,
        isEnabled: (agent) => isMobileTuiAgentEnabled(agent, hostSettings.disabledAgents)
      }),
    [executionTarget.detectedAgentIds, hostSettings.disabledAgents]
  )
  const selection = held
    ? withAvailableCreateSessionAgent(held, agents, hostSettings.preferredAgent)
    : null
  const options = useCreateSessionOptions(client, selection?.agent ?? null)

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
      return launchCreateSession({
        client,
        hostId,
        repo,
        plan: launchPlan,
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
  const canSubmit =
    selection !== null &&
    plan !== null &&
    canSubmitCreateSession({
      draft,
      selection,
      repos,
      sshReady,
      busy: submitState.phase.kind === 'creating' || blankBusy
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
    agentChoices: agents.map((agent) => ({
      value: agent,
      label: createSessionAgentLabel(agent),
      description: ''
    })),
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
      const agent = agents.find((candidate) => candidate === value)
      if (agent) {
        update((current) => ({ ...current, agent }))
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
