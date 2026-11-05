import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { holdStructuredAgentSessionLaunchPicks } from '@/lib/structured-agent-session-launch-options'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/structured-agent-session-provisional-tab'
import { structuredAgentSessionTabId } from '../../../../shared/structured-agent-session-projection'
import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../../shared/execution-host'
import { getRepoMainWorktreeId } from '../../../../shared/worktree/id'
import type { ProjectlessChatWorkspaceErrorCode } from '../../../../shared/projectless-chat-folder'
import {
  isFloatingPlacement,
  loadFloatingCreateLaunch,
  openCreateChatWorkspace,
  workspaceTabIds,
  type CreateChatPlacement
} from './create-chat-placement'
import { createChatRepoOptions } from './create-chat-repo-options'
import {
  canUseProjectless,
  findRepo,
  type CreateChatRepoOption,
  type CreateChatSelection,
  type CreateChatSubmitOutcome
} from './create-chat-selection'
import {
  createChatInNewWorktree,
  createChatNamingFor,
  createChatSeedPicks,
  createTerminalInNewWorktree
} from './create-chat-new-worktree'
import { launchTerminalInWorkspace } from './create-chat-terminal-launch'

export { createChatSeedPicks }

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

function openWorkspaceMessage(): string {
  return translate(
    'components.createChat.errorOpenWorkspace',
    'Could not open the workspace for this chat. Your draft is kept.'
  )
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

/** Starts the session the view picked in this workspace: the structured chat, or the agent's terminal. */
async function launchInWorkspace(
  worktreeId: string,
  executionHostId: ExecutionHostId,
  draft: string,
  selection: CreateChatSelection,
  placement: CreateChatPlacement
): Promise<CreateChatSubmitOutcome> {
  if (selection.sessionView !== 'terminal') {
    return launchChatInWorkspace(worktreeId, executionHostId, draft, selection, placement)
  }
  const launch = await launchTerminalInWorkspace(worktreeId, draft, selection, placement)
  if (launch === 'workspace-unavailable') {
    return failed(openWorkspaceMessage())
  }
  return launch === 'opened' ? started : failed(startFailedMessage())
}

/** Opens the workspace, then starts the structured chat there with the first message. */
function launchChatInWorkspace(
  worktreeId: string,
  executionHostId: ExecutionHostId,
  draft: string,
  selection: CreateChatSelection,
  placement: CreateChatPlacement
): CreateChatSubmitOutcome {
  if (!openCreateChatWorkspace(worktreeId, placement)) {
    return failed(openWorkspaceMessage())
  }
  const floating = isFloatingPlacement(placement) ? placement : null
  const knownTabIds = floating ? workspaceTabIds(worktreeId) : new Set<string>()
  const plan = adoptAgentSessionLaunchVerdict({
    route: 'structured-native-chat',
    requestId: newAgentLaunchRequestId(),
    agent: selection.agent,
    worktreeId,
    executionHostId,
    prompt: draft,
    promptDelivery: 'auto-submit'
  })
  let opened = false
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan,
    hooks: {},
    target: { worktreeId, executionHostId },
    activate: floating === null,
    // Why: a host-admitted chat gets its session id only once its tab opens.
    onOpened: (sessionId) => {
      holdStructuredAgentSessionLaunchPicks(sessionId, createChatSeedPicks(selection))
      if (floating) {
        opened = true
        void loadFloatingCreateLaunch().then((floatingLaunch) =>
          floatingLaunch.showFloatingCreateLaunch({
            worktreeId,
            tabId: structuredAgentSessionTabId(sessionId),
            knownTabIds,
            createTabId: floating.createTabId
          })
        )
      }
    }
  })
  if (!launch) {
    return failed(startFailedMessage())
  }
  if (floating) {
    // Why: a launch that opens no chat tab (its host declined it to a terminal, or it was abandoned) must not leave its New Session tab waiting.
    void launch.settlement.then((settled) => {
      if (opened) {
        return
      }
      void loadFloatingCreateLaunch().then((floatingLaunch) => {
        if (settled.kind === 'terminal') {
          floatingLaunch.showFloatingCreateLaunch({
            worktreeId,
            tabId: null,
            knownTabIds,
            createTabId: floating.createTabId
          })
          return
        }
        floatingLaunch.clearFloatingCreateLaunch(floating.createTabId)
      })
    })
  }
  return started
}

async function submitProjectless(
  draft: string,
  selection: CreateChatSelection,
  placement: CreateChatPlacement
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
  return await launchInWorkspace(
    result.workspaceKey,
    LOCAL_EXECUTION_HOST_ID,
    draft,
    selection,
    placement
  )
}

async function launchExistingWorktree(
  draft: string,
  selection: CreateChatSelection,
  repo: CreateChatRepoOption,
  placement: CreateChatPlacement
): Promise<CreateChatSubmitOutcome> {
  const worktreeId = selection.existingWorktreeId
  const exists = (useAppStore.getState().worktreesByRepo[repo.repoId] ?? []).some(
    (worktree) => worktree.id === worktreeId
  )
  if (worktreeId === undefined || !exists) {
    return failed(
      translate(
        'components.createChat.errorWorktreeGone',
        'This worktree is no longer available. Pick another one.'
      )
    )
  }
  return await launchInWorkspace(worktreeId, repo.hostId, draft, selection, placement)
}

async function submitInProject(
  draft: string,
  selection: CreateChatSelection,
  placement: CreateChatPlacement
): Promise<CreateChatSubmitOutcome> {
  const state = useAppStore.getState()
  const repo = findRepo(createChatRepoOptions(state.repos), selection.project)
  const fullRepo = state.repos.find((candidate) => candidate.id === repo?.repoId)
  if (!repo || !fullRepo || repo.hostId !== selection.executionHostId) {
    return failed(
      translate(
        'components.createChat.errorMissingProject',
        'This project is no longer available. Pick another one.'
      )
    )
  }
  // Why: a folder has no git worktrees, so it always opens its one workspace.
  if (repo.isFolder || selection.workspaceMode === 'current-checkout') {
    return await launchInWorkspace(
      primaryWorkspaceId(repo),
      repo.hostId,
      draft,
      selection,
      placement
    )
  }
  if (selection.workspaceMode === 'existing-worktree') {
    return await launchExistingWorktree(draft, selection, repo, placement)
  }
  if (selection.sessionView === 'terminal') {
    return await createTerminalInNewWorktree(draft, selection, repo, fullRepo, placement)
  }
  return await createChatInNewWorktree(draft, selection, repo, placement)
}

/**
 * Resolves the workspace the chat runs in, then launches the structured session with the first
 * message. Never throws: every failure comes back as a message for the composer to show.
 */
export async function submitCreateChatDraft(
  draft: string,
  selection: CreateChatSelection,
  placement: CreateChatPlacement = 'main-window'
): Promise<CreateChatSubmitOutcome> {
  try {
    return selection.project.kind === 'none'
      ? await submitProjectless(draft, selection, placement)
      : await submitInProject(draft, selection, placement)
  } catch (error) {
    console.error('create chat: submit failed', error)
    return failed(startFailedMessage())
  }
}
