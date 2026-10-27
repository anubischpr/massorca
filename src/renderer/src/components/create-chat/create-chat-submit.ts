import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'
import { holdStructuredAgentSessionLaunchPicks } from '@/lib/structured-agent-session-launch-options'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/structured-agent-session-provisional-tab'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { runBackgroundWorktreeCreation } from '@/lib/worktree-creation-flow'
import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../../shared/execution-host'
import { getRepoMainWorktreeId } from '../../../../shared/worktree/id'
import type { ProjectlessChatWorkspaceErrorCode } from '../../../../shared/projectless-chat-folder'
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
    activate: true
  })
  if (!launch) {
    return failed(startFailedMessage())
  }
  // Why: a host-admitted chat has no session id yet; its picks then wait for the host's own seed.
  if (launch.sessionId) {
    holdStructuredAgentSessionLaunchPicks(launch.sessionId, createChatSeedPicks(selection))
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
    title: draft,
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
function createChatInNewWorktree(
  draft: string,
  selection: CreateChatSelection,
  repo: CreateChatRepoOption
): CreateChatSubmitOutcome {
  const request: WorktreeCreationRequest = {
    repoId: repo.repoId,
    executionHostId: repo.hostId,
    // Why: same naming as the new-workspace composer, so a prompt-named workspace looks the same from either place.
    name: getWorkspaceSeedName({
      explicitName: '',
      prompt: draft,
      linkedIssueNumber: null,
      linkedPR: null
    }),
    // Why: a repo setup script opens its own terminal tab, and a chat-first create asks for the chat alone.
    setupDecision: 'skip',
    agent: selection.agent,
    agentLaunchRoute: 'structured-native-chat',
    quickPrompt: draft,
    promptDelivery: 'auto-submit',
    structuredSeedPicks: createChatSeedPicks(selection),
    pendingFirstAgentMessageRename: false,
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
  return createChatInNewWorktree(draft, selection, repo)
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
