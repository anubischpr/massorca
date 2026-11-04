import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { isFreshOrAwaitingNonDoneAgentStatus } from '../../../../shared/agent-status-freshness'
import { formatAgentTypeLabel } from '../../../../shared/agent-type-label'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import type { AppState } from '../../store/types'

export type ApprovalSourceState = Pick<
  AppState,
  'agentStatusByPaneKey' | 'tabsByWorktree' | 'unifiedTabsByWorktree'
> & { settings: Pick<NonNullable<AppState['settings']>, 'tabAutoGenerateTitle'> | null }

export type ApprovalRow = {
  paneKey: string
  tabId: string
  worktreeId: string
  title: string
  line: string
  agentLabel: string
  waitingSince: number
}

const LINE_MAX_LENGTH = 140

function firstLine(text: string | undefined): string {
  return (text ?? '').split('\n', 1)[0].trim().slice(0, LINE_MAX_LENGTH)
}

function findOwnerWorktreeId(
  state: ApprovalSourceState,
  entry: AgentStatusEntry,
  tabId: string
): string | null {
  if (entry.worktreeId) {
    return entry.worktreeId
  }
  for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
    if (tabs.some((tab) => tab.id === tabId || tab.entityId === tabId)) {
      return worktreeId
    }
  }
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    if (tabs.some((tab) => tab.id === tabId)) {
      return worktreeId
    }
  }
  return null
}

function sessionTitle(
  state: ApprovalSourceState,
  entry: AgentStatusEntry,
  worktreeId: string,
  tabId: string
): string {
  const unified = state.unifiedTabsByWorktree[worktreeId]?.find(
    (tab) => tab.id === tabId || tab.entityId === tabId
  )
  const terminal = state.tabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)
  const named = unified
    ? resolveUnifiedTabLabel(
        {
          ...unified,
          quickCommandLabel: unified.quickCommandLabel ?? terminal?.quickCommandLabel,
          generatedLabel: unified.generatedLabel ?? terminal?.generatedTitle
        },
        state.settings?.tabAutoGenerateTitle === true,
        terminal?.title ?? ''
      )
    : (terminal?.customTitle ?? terminal?.title ?? '')
  return named.trim() || firstLine(entry.prompt) || formatAgentTypeLabel(entry.agentType)
}

/**
 * Sessions waiting on the user, read from the agent status store: a blocked or waiting
 * entry, held until its pane reports or closes, whose tab and workspace resolve. Longest wait first.
 */
export function deriveApprovalRows(state: ApprovalSourceState, now = Date.now()): ApprovalRow[] {
  const rows: ApprovalRow[] = []
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    if (entry.state !== 'blocked' && entry.state !== 'waiting') {
      continue
    }
    if (!isFreshOrAwaitingNonDoneAgentStatus(entry, now)) {
      continue
    }
    const tabId = parsePaneKey(paneKey)?.tabId
    if (!tabId) {
      continue
    }
    const worktreeId = findOwnerWorktreeId(state, entry, tabId)
    if (!worktreeId) {
      continue
    }
    rows.push({
      paneKey,
      tabId,
      worktreeId,
      title: sessionTitle(state, entry, worktreeId, tabId),
      line: firstLine(entry.lastAssistantMessage) || firstLine(entry.toolName),
      agentLabel: formatAgentTypeLabel(entry.agentType),
      waitingSince: entry.stateStartedAt
    })
  }
  return rows.sort((a, b) => a.waitingSince - b.waitingSince)
}
