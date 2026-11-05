import { useAppStore } from '@/store'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import { getSuggestedCreatureName } from '@/components/sidebar/worktree-name-suggestions'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'
import { runBackgroundWorktreeCreation } from '@/lib/worktree-creation-flow'
import type { Repo } from '../../../../shared/repo-types'
import type { CreateChatNamingOverride } from '../../../../shared/create-chat-session-naming'
import {
  EMPTY_RETIRED_NAME_REGISTRY,
  type RetiredNameRegistry
} from '../../../../shared/worktree/retired-name-registry'
import {
  announceFloatingNewWorktreeSession,
  type CreateChatPlacement
} from './create-chat-placement'
import type {
  CreateChatRepoOption,
  CreateChatSelection,
  CreateChatSubmitOutcome
} from './create-chat-selection'
import { buildCreateChatTerminalStartup } from './create-chat-terminal-startup'

const started: CreateChatSubmitOutcome = { started: true }

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
export function createChatNamingFor(selection: CreateChatSelection): CreateChatNamingOverride {
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

/** A new worktree goes through the composer's create flow; the chat launches once it exists. */
export async function createChatInNewWorktree(
  draft: string,
  selection: CreateChatSelection,
  repo: CreateChatRepoOption,
  placement: CreateChatPlacement
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
  return startNewWorktreeCreation(request, placement)
}

/** A new worktree whose startup runs the agent in a terminal: the terminal is the session's surface. */
export async function createTerminalInNewWorktree(
  draft: string,
  selection: CreateChatSelection,
  repo: CreateChatRepoOption,
  fullRepo: Repo,
  placement: CreateChatPlacement
): Promise<CreateChatSubmitOutcome> {
  const { startupPlan, backendStartup, telemetry } = buildCreateChatTerminalStartup(
    fullRepo,
    selection.agent,
    draft
  )
  const request: WorktreeCreationRequest = {
    repoId: repo.repoId,
    executionHostId: repo.hostId,
    name: await temporaryWorkspaceName(repo.repoId),
    nameWasGenerated: true,
    setupDecision: 'run',
    agent: selection.agent,
    agentLaunchRoute: 'terminal-tui',
    quickPrompt: draft,
    promptDelivery: 'auto-submit',
    startupPlan,
    startup: backendStartup,
    quickTelemetry: telemetry,
    // Why: the card shows the pending rename only when auto-rename will actually run.
    pendingFirstAgentMessageRename:
      useAppStore.getState().settings?.autoRenameBranchFromWork === true,
    note: ''
  }
  return startNewWorktreeCreation(request, placement)
}

/** The main window shows the creation surface; the floating workspace leaves it alone. */
function startNewWorktreeCreation(
  request: WorktreeCreationRequest,
  placement: CreateChatPlacement
): CreateChatSubmitOutcome {
  if (placement === 'main-window') {
    runBackgroundWorktreeCreation(request)
    return started
  }
  runBackgroundWorktreeCreation(request, { revealCreationSurface: false })
  announceFloatingNewWorktreeSession()
  return started
}
