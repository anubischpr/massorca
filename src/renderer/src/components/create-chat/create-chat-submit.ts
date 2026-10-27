import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import { getSuggestedCreatureName } from '@/components/sidebar/worktree-name-suggestions'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'
import { holdStructuredAgentSessionLaunchPicks } from '@/lib/structured-agent-session-launch-options'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/structured-agent-session-provisional-tab'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { runBackgroundWorktreeCreation } from '@/lib/worktree-creation-flow'
import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../../shared/execution-host'
import { getRepoMainWorktreeId } from '../../../../shared/worktree/id'
import type { CreateChatNamingOverride } from '../../../../shared/create-chat-session-naming'
import type { ProjectlessChatWorkspaceErrorCode } from '../../../../shared/projectless-chat-folder'
import {
  EMPTY_RETIRED_NAME_REGISTRY,
  type RetiredNameRegistry
} from '../../../../shared/worktree/retired-name-registry'
import { createChatRepoOptions } from './create-chat-repo-options'
import {
  canUseProjectless,
  findRepo,
  type CreateChatRepoOption,
  type CreateChatSelection,
  type CreateChatSubmitOutcome
} from './create-chat-selection'

const started: CreateChatSubmitOutcome = { started: true }

function failed(message: string): CreateChatSubmitOutcome {
  return { started: false, message }
}

function startFailedMessage(): string {
  return translate(
    'components.createChat.errorStart',
    'Could not start the session. Your draft is kept.'
  )
}

/** Per-chat picks. Model and effort go first: a model pick drops the picks held under the model it replaces. */
export function createChatSeedPicks(selection: CreateChatSelection): Record<string, string> {
  return {
    ...(selection.model ? { model: selection.model } : {}),
    ...(selection.effort ? { effort: selection.effort } : {}),
    // Why: create seeds the saved default, so the chosen preset must be held to apply it.
    accessMode: selection.accessMode
  }
}

/** The first-work rename names the workspace with the session's agent and this pick. */
function createChatNamingFor(selection: CreateChatSelection): CreateChatNamingOverride {
  return { model: selection.model ?? null }
}

async function loadRetiredNames(repoId: string): Promise<RetiredNameRegistry> {
  try {
    return await window.api.worktrees.listRetiredNames({ repoId })
  } catch (error) {
    // Why: without the retired list a spent creature name may be reused; the workspace still gets created.
    console.warn('create chat: retired workspace names unavailable', error)
    return EMPTY_RETIRED_NAME_REGISTRY
  }
}

/** Same creature pool as the composer's blank name, so the first-work rename can replace it. */
async function temporaryWorkspaceName(repoId: string): Promise<string> {
  const retired = await loadRetiredNames(repoId)
  return getWorkspaceSeedName({
    explicitName: '',
    prompt: '',
    linkedIssueNumber: null,
    linkedPR: null,
    fallbackName: getSuggestedCreatureName(
      useAppStore.getState().worktreesByRepo,
      undefined,
      retired
    )
  })
}

function projectlessErrorMessage(code: ProjectlessChatWorkspaceErrorCode): string {
  return code === 'ssh_location_unsupported'
    ? translate(
        'components.createChat.errorProjectlessLocation',
        'Projectless chats can only be created on this computer.'
      )
    : translate(
        'components.createChat.errorProjectlessWeb',
        'Projectless chats are not available in this client.'
      )
}

/** The repo's primary checkout; creates nothing. */
function primaryWorkspaceId(repo: CreateChatRepoOption): string {
  const worktrees = useAppStore.getState().worktreesByRepo[repo.repoId] ?? []
  return (
    worktrees.find((worktree) => worktree.isMainWorktree)?.id ??
    getRepoMainWorktreeId({ id: repo.repoId, path: repo.path })
  )
}

/** Opens the workspace, then starts the structured chat there with the first message. */
function launchChatInWorkspace(
  worktreeId: string,
  executionHostId: ExecutionHostId,
  draft: string,
  selection: CreateChatSelection
): CreateChatSubmitOutcome {
  const activated = activateAndRevealWorkspace(worktreeId, { providesInitialSurface: true })
  if (activated === false) {
    return failed(
      translate(
        'components.createChat.errorOpenWorkspace',
        'Could not open the workspace for this chat. Your draft is kept.'
      )
    )
  }
  const plan = adoptAgentSessionLaunchVerdict({
    route: 'structured-native-chat',
    requestId: newAgentLaunchRequestId(),
    agent: selection.agent,
    worktreeId,
    executionHostId,
    prompt: draft,
    promptDelivery: 'auto-submit'
  })
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan,
    hooks: {},
    target: { worktreeId, executionHostId },
    activate: true,
    // Why: a host-admitted chat gets its session id only once its tab opens.
    onOpened: (sessionId) => {
      holdStructuredAgentSessionLaunchPicks(sessionId, createChatSeedPicks(selection))
    }
  })
  if (!launch) {
    return failed(startFailedMessage())
  }
  return started
}

async function submitProjectless(
  draft: string,
  selection: CreateChatSelection
): Promise<CreateChatSubmitOutcome> {
  if (!canUseProjectless(selection.executionHostId)) {
    return failed(projectlessErrorMessage('ssh_location_unsupported'))
  }
  const result = await window.api.projectlessChats.createWorkspace({
    createdWithAgent: selection.agent,
    createChatNaming: createChatNamingFor(selection),
    connectionId: null
  })
  if (!result.ok) {
    return failed(projectlessErrorMessage(result.code))
  }
  // Why: the main process created the group and folder workspace; the renderer must load them before it can open them.
  const store = useAppStore.getState()
  await store.fetchProjectGroupsForAllHosts({ remoteHosts: 'skip' })
  await store.fetchFolderWorkspacesForAllHosts({ remoteHosts: 'skip' })
  return launchChatInWorkspace(result.workspaceKey, LOCAL_EXECUTION_HOST_ID, draft, selection)
}

/** A new worktree goes through the composer's create flow; the chat launches once it exists. */
async function createChatInNewWorktree(
  draft: string,
  selection: CreateChatSelection,
  repo: CreateChatRepoOption
): Promise<CreateChatSubmitOutcome> {
  const request: WorktreeCreationRequest = {
    repoId: repo.repoId,
    executionHostId: repo.hostId,
    // Why: a temporary creature name; the first agent message renames the branch and display name.
    name: await temporaryWorkspaceName(repo.repoId),
    nameWasGenerated: true,
    // Why: the repo setup runs in a hidden terminal the chat roster shows; the chat stays the only tab.
    setupDecision: 'run',
    setupPresentation: 'chat-background-task',
    agent: selection.agent,
    agentLaunchRoute: 'structured-native-chat',
    quickPrompt: draft,
    promptDelivery: 'auto-submit',
    structuredSeedPicks: createChatSeedPicks(selection),
    // Why: the card shows the pending rename only when auto-rename will actually run.
    pendingFirstAgentMessageRename:
      useAppStore.getState().settings?.autoRenameBranchFromWork === true,
    createChatNaming: createChatNamingFor(selection),
    note: '',
    startupPlan: null,
    quickTelemetry: null
  }
  runBackgroundWorktreeCreation(request)
  return started
}

async function submitInProject(
  draft: string,
  selection: CreateChatSelection
): Promise<CreateChatSubmitOutcome> {
  const repos = createChatRepoOptions(useAppStore.getState().repos)
  const repo = findRepo(repos, selection.project)
  if (!repo || repo.hostId !== selection.executionHostId) {
    return failed(
      translate(
        'components.createChat.errorMissingProject',
        'This project is no longer available. Pick another one.'
      )
    )
  }
  // Why: a folder has no git worktrees, so it always opens its one workspace.
  if (repo.isFolder || selection.workspaceMode === 'current-checkout') {
    return launchChatInWorkspace(primaryWorkspaceId(repo), repo.hostId, draft, selection)
  }
  return await createChatInNewWorktree(draft, selection, repo)
}

/**
 * Resolves the workspace the chat runs in, then launches the structured session with the first
 * message. Never throws: every failure comes back as a message for the composer to show.
 */
export async function submitCreateChatDraft(
  draft: string,
  selection: CreateChatSelection
): Promise<CreateChatSubmitOutcome> {
  try {
    return selection.project.kind === 'none'
      ? await submitProjectless(draft, selection)
      : await submitInProject(draft, selection)
  } catch (error) {
    console.error('create chat: submit failed', error)
    return failed(startFailedMessage())
  }
}
