import type {
  AgentSubjectRead,
  AgentSubjectReadIntent
} from '@/attention/agent-subject-read-actions'
import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { GitHubWorkItem } from '../../../../../shared/github/work-item-types'
import type { GitLabWorkItem } from '../../../../../shared/gitlab-types'
import type { JiraIssue } from '../../../../../shared/jira-types'
import type { LinearIssue } from '../../../../../shared/linear/issue-types'
import type { TaskProvider } from '../../../../../shared/task-providers'
import type { TuiAgent } from '../../../../../shared/tui-agent'
import type { LaunchSource } from '../../../../../shared/telemetry-events'
import type { TaskSourceContext } from '../../../../../shared/task-source-context'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type { TaskResumeState, TopLevelView } from '../../../../../shared/ui-chrome-types'
import type { MarketplaceAppStatus } from '../../../../../shared/marketplace-apps'

/** A Marketplace sidebar choice: a catalog section, or Your apps (what is installed and connected). */
export type MarketplaceSection = 'all' | 'tools' | 'agents' | 'skills' | 'services' | 'your-apps'

/** A catalog item. Git keeps its own page; the other three use the standard app page. */
export type MarketplaceItemId = 'git' | 'github' | 'engram' | 'openmetadata'

/** The Marketplace apps status; the sidebar, the catalog and the app pages read this one copy. */
export type MarketplaceAppsState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'failed' }
  | { status: 'ready'; apps: readonly MarketplaceAppStatus[] }

/** A page of the open team other than its Conference room. */
export type BotTeamsSection =
  | { kind: 'board' }
  | { kind: 'new-project' }
  /** `path` opens that file of the team folder, as a file chip in the room does. */
  | { kind: 'files'; path?: string }
  | { kind: 'memory' }
  | { kind: 'routines' }
  /** With a routineId, the form edits that routine. */
  | { kind: 'routine-new'; routineId?: string }
  | { kind: 'routine'; routineId: string }
  /** A team's web address that starts a task; no id means making a new one. */
  | { kind: 'webhook'; webhookId?: string }
  | { kind: 'project'; projectId: string; tab?: 'brief' }

export type BotTeamsSelection = {
  /** The open team, or null for All teams. */
  teamId: string | null
  /** A task thread open inside the team. */
  taskId: string | null
  /** The new team form is open. */
  creating: boolean
  /** The open team's Board, a project, New project, Files, Memory or Routines; none means the Conference room. */
  section?: BotTeamsSection
}

export type PendingSidebarWorktreeReveal = {
  worktreeId: string
  executionHostId?: ExecutionHostId
  behavior: 'auto' | 'smooth'
  highlight?: boolean
  beginRename?: boolean
}

export type PendingSidebarRowReveal = {
  rowKey: string
  behavior: 'auto' | 'smooth'
  highlight?: boolean
}

export type AgentSendPopoverTargetMode = {
  id: string
  instanceId: string
  worktreeId: string
  source: 'diff-notes' | 'browser-annotations'
  prompt: string
  label: string
  launchSource: LaunchSource
  eligiblePaneKeys: string[]
  disabledPaneKeys: Record<string, string>
  status: 'open' | 'sending' | 'error'
  sendingPaneKey?: string
  error?: string
  onPromptDelivered?: () => void
  /** Told the send's own result the moment the prompt is handed to an agent. */
  onPromptHandedOff?: (delivered: Promise<unknown>) => void
}

export type OpenAgentSendPopoverTargetModeArgs = {
  id: string
  worktreeId: string
  source: AgentSendPopoverTargetMode['source']
  prompt: string
  label: string
  launchSource: LaunchSource
  onPromptDelivered?: () => void
  onPromptHandedOff?: (delivered: Promise<unknown>) => void
}

export type TaskPageData = {
  preselectedRepoId?: string
  prefilledName?: string
  taskSource?: TaskProvider
  openGitHubWorkItem?: GitHubWorkItem
  openGitHubSourceContext?: TaskSourceContext | null
  openGitHubInitialTab?: 'conversation' | 'checks' | 'files'
  openGitLabWorkItem?: GitLabWorkItem
  openGitLabSourceContext?: TaskSourceContext | null
  openLinearIssue?: LinearIssue
  openLinearSourceContext?: TaskSourceContext | null
  openJiraIssue?: JiraIssue
  openJiraSourceContext?: TaskSourceContext | null
}

export type NewWorkspaceDraft = {
  repoId: string | null
  // Why: project-first creation uses these when present; old drafts keep using only repoId during the additive migration.
  projectId?: string | null
  projectGroupId?: string | null
  hostId?: ExecutionHostId | null
  projectHostSetupId?: string | null
  name: string
  prompt: string
  note: string
  attachments: string[]
  linkedWorkItem: {
    provider?: 'github' | 'gitlab' | 'linear' | 'jira'
    type: 'issue' | 'pr' | 'mr'
    number: number
    title: string
    url: string
    linearIdentifier?: string
    linearBranchName?: string
    jiraIdentifier?: string
    repoId?: string
  } | null
  /** Preserve where provider data came from, separately from the host chosen to run the workspace. */
  taskSourceContext?: TaskSourceContext | null
  linkedTaskSourceContext?: TaskSourceContext | null
  agent: TuiAgent
  linkedIssue: string
  linkedPR: number | null
  /** GitLab parallels — number for an issue, iid for an MR. Optional so pre-GitLab drafts still load without migration. */
  linkedGitLabIssue?: number | null
  linkedGitLabMR?: number | null
  // Why: repo-scoped start ref from the "Start from" picker; absent means "use the repo's effective base ref".
  baseBranch?: string
  // Why: false when `baseBranch` came from the base-ref picker rather than a branch pick, so restoring the
  // draft doesn't turn it back into a name-field pill. Absent on pre-flag drafts, which restore as a pick.
  baseBranchNamesWorkspace?: boolean
  // Why: review worktrees start from a head ref/SHA while Source Control compares against the provider target branch.
  compareBaseRef?: string
}

export type UiViewHistory =
  | 'terminal'
  | 'settings'
  | 'tasks'
  | 'activity'
  | 'automations'
  | 'space'
  | 'skills'
  | 'artifacts'
  | 'prototypes'
  | 'bot-teams'
  | 'mobile'
  | 'create-chat'
  | 'calendar'
  | 'marketplace'

export type UISliceCore = {
  sidebarOpen: boolean
  sidebarWidth: number
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  agentSendPopoverTargetMode: AgentSendPopoverTargetMode | null
  openAgentSendPopoverTargetMode: (args: OpenAgentSendPopoverTargetModeArgs) => void
  closeAgentSendPopoverTargetMode: (id?: string, instanceId?: string) => void
  sendPromptToSidebarAgentTarget: (paneKey: string) => Promise<boolean>
  /** Bumped to ask the active worktree's Source Control notes send menu to open (keyboard shortcut). `issuedAt` bounds staleness so a request the menu never consumed can't reopen it much later. */
  diffNotesSendMenuOpenRequest: { worktreeId: string; nonce: number; issuedAt: number } | null
  /** Reveal Source Control and request its notes send menu open; returns false (no-op) when the active worktree has no unsent notes. */
  openDiffNotesSendMenuForActiveWorktree: () => boolean
  consumeDiffNotesSendMenuOpenRequest: (worktreeId: string) => void
  /** Per-agent "I've looked at this" timestamps (paneKey → ts). A row is unvisited when no ack exists or stateStartedAt is newer than the last ack. Persisted so visited rows don't return bold on relaunch. */
  acknowledgedAgentsByPaneKey: Record<string, number>
  /** `explicit` only from a user action on the row (Mark read, a jump, a dashboard ack). */
  acknowledgeAgents: (
    paneKeys: string[],
    reads?: readonly AgentSubjectRead[],
    intent?: AgentSubjectReadIntent
  ) => void
  unacknowledgeAgents: (paneKeys: string[]) => void
  /** Per-pane cutoffs used to hide activity entries cleared by the user. */
  activityClearedAtByPaneKey: Record<string, number>
  applyActivityClearedAt: (patch: Record<string, number | null>) => void
  /** Session-local protection for turns explicitly marked unread. */
  manuallyUnreadTurnsByPaneKey: Record<string, number>
  clearManuallyUnreadTurns: (paneKeys: string[]) => void
  activeView: TopLevelView
  previousViewBeforeTasks: Exclude<UiViewHistory, 'tasks'>
  previousViewBeforeSettings: Exclude<UiViewHistory, 'settings'>
  previousViewBeforeActivity: Exclude<UiViewHistory, 'activity'>
  previousViewBeforeAutomations: Exclude<UiViewHistory, 'automations'>
  previousViewBeforeSpace: Exclude<UiViewHistory, 'space'>
  previousViewBeforeSkills: Exclude<UiViewHistory, 'skills'>
  previousViewBeforeMobile: Exclude<UiViewHistory, 'mobile'>
  previousViewBeforeArtifacts: Exclude<UiViewHistory, 'artifacts'>
  previousViewBeforePrototypes: Exclude<UiViewHistory, 'prototypes'>
  previousViewBeforeMarketplace: Exclude<UiViewHistory, 'marketplace'>
  setActiveView: (view: UISliceCore['activeView']) => void
  taskPageData: TaskPageData
  taskResumeState: TaskResumeState | undefined
  setTaskResumeState: (updates: Partial<TaskResumeState>) => void
  taskListPosition: { contextKey: string; page: number; scrollTop: number } | null
  setTaskListPosition: (position: UISliceCore['taskListPosition']) => void
  githubTaskDrawerWorkItem: GitHubWorkItem | null
  setGithubTaskDrawerWorkItem: (item: GitHubWorkItem | null) => void
  newWorkspaceDraft: NewWorkspaceDraft | null
  openTaskPage: (
    data?: UISliceCore['taskPageData'],
    options?: { recordTasksInteraction?: boolean }
  ) => void
  closeTaskPage: () => void
  openActivityPage: () => void
  closeActivityPage: () => void
  selectedAutomationId: string | null
  setSelectedAutomationId: (id: string | null) => void
  pendingAutomationRunNavigation: {
    automationId: string
    runId: string | null
    hostId?: ExecutionHostId
  } | null
  setPendingAutomationRunNavigation: (
    navigation: { automationId: string; runId: string | null; hostId?: ExecutionHostId } | null
  ) => void
  openAutomationsPage: () => void
  closeAutomationsPage: () => void
  openSpacePage: () => void
  closeSpacePage: () => void
  openSkillsPage: () => void
  closeSkillsPage: () => void
  pendingSkillShareId: string | null
  openSkillShare: (shareId: string) => void
  clearPendingSkillShare: () => void
  /** Set when another surface links straight to the page's shared-links view. */
  pendingSkillsSharedView: boolean
  openSkillsSharedLinks: () => void
  clearPendingSkillsSharedView: () => void
  openArtifactsPage: () => void
  closeArtifactsPage: () => void
  openPrototypesPage: () => void
  closePrototypesPage: () => void
  openMobilePage: () => void
  closeMobilePage: () => void
  /** Opens a blank create-chat view; each open bumps the nonce so the view remounts blank. */
  createChatResetNonce: number
  openCreateChatPage: () => void
  /** True while the tasks view shows the Tasks home instead of the source-control board. */
  tasksHomeOpen: boolean
  /** Which mode the rail's first button is in; it survives every page change and restart. */
  railMode: 'workspaces' | 'bot-teams'
  /** The one-time "click Workspaces again" hint has been shown. */
  railWorkspacesHintShown: boolean
  markRailWorkspacesHintShown: () => void
  /**
   * The rail's first button: from its mode's home it switches mode, from any other page it
   * returns to the current mode's home. Reports which one happened.
   */
  pressRailModeButton: () => 'switched' | 'returned'
  /** What the Bot teams page shows; the left sidebar and the page both read and write it. */
  botTeamsSelection: BotTeamsSelection
  /** Shows the Bot teams page with this selection and puts the rail in Bot teams mode. */
  openBotTeamsView: (selection?: Partial<BotTeamsSelection>) => void
  /** Changes what the open Bot teams page shows, without moving the page. */
  setBotTeamsSelection: (selection: BotTeamsSelection) => void
  openTasksHome: () => void
  /** The rail's Calendar page: scheduled bot runs and automations. */
  openCalendarPage: () => void
  openMarketplacePage: () => void
  /** Opens the Marketplace catalog on one section, from another page. */
  openMarketplaceSection: (section: MarketplaceSection) => void
  closeMarketplacePage: () => void
  /** The Marketplace sidebar's section; the catalog list shows its items. */
  marketplaceSection: MarketplaceSection
  setMarketplaceSection: (section: MarketplaceSection) => void
  /** The item whose page the Marketplace main area shows; null shows the catalog. */
  marketplaceSelectedItemId: MarketplaceItemId | null
  selectMarketplaceItem: (id: MarketplaceItemId | null) => void
  marketplaceApps: MarketplaceAppsState
  refreshMarketplaceApps: () => Promise<void>
  setNewWorkspaceDraft: (draft: NonNullable<UISliceCore['newWorkspaceDraft']>) => void
  clearNewWorkspaceDraft: () => void
  pendingRevealWorktree: PendingSidebarWorktreeReveal | null
  pendingRevealSidebarRow: PendingSidebarRowReveal | null
  revealWorktreeInSidebar: (
    worktreeId: string,
    options?: {
      behavior?: PendingSidebarWorktreeReveal['behavior']
      highlight?: boolean
      beginRename?: boolean
      executionHostId?: ExecutionHostId
    }
  ) => void
  revealSidebarRow: (
    rowKey: string,
    options?: {
      behavior?: PendingSidebarRowReveal['behavior']
      highlight?: boolean
    }
  ) => void
}

export type UISliceSet = Parameters<StateCreator<AppState, [], [], UISliceCore>>[0]
export type UISliceGet = Parameters<StateCreator<AppState, [], [], UISliceCore>>[1]
