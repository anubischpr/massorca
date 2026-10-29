import { useMemo } from 'react'
import { applyAiVaultAutomatedRunsSwitch } from '../../../../shared/ai-vault-automated-run'
import type { AiVaultAgent, AiVaultGroup, AiVaultSession } from '../../../../shared/ai-vault-types'
import { piRuntimeForSessionFilePath } from '../../../../shared/pi-runtime-selection'
import { piRuntimeLabel, type PiDisplayRuntime } from '@/lib/pi-agent-display'
import {
  agentLabel as sharedAgentLabel,
  filterAiVaultSessions,
  groupAiVaultSessions,
  type AiVaultSessionFilterState
} from '../../../../shared/ai-vault-session-filters'
// Why: the pure filter/group/query core now lives in /shared so the mobile
// package can reuse it (Metro can't import renderer). Re-export for renderer
// import parity. Not a byte-for-byte move: tokenizeQuery gained quoted
// repo:/path: operator values (e.g. path:"/a/My Project"), which the old
// renderer tokenizer split on spaces.
export type {
  AiVaultSessionProject,
  AiVaultSessionFilterState,
  AiVaultSessionGroup
} from '../../../../shared/ai-vault-session-filters'
export {
  AI_VAULT_SESSION_FILTER_QUERY_MAX_BYTES,
  agentLabel,
  filterAiVaultSessions,
  folderLabel,
  groupAiVaultSessions,
  isAiVaultSessionFilterQueryTooLarge,
  parseVaultQuery
} from '../../../../shared/ai-vault-session-filters'

/** What the list renders: a null label is a group of rows with no header of its own. */
export type AiVaultSessionListGroup = {
  key: string
  label: string | null
  sessions: AiVaultSession[]
}

export function useAiVaultPanelSessions(
  sessions: readonly AiVaultSession[],
  searching: boolean,
  group: AiVaultGroup,
  {
    query,
    agents,
    scope,
    sort,
    activeWorktreePaths,
    excludedWorktreePaths,
    activeProjectKey,
    sessionProjectById,
    projectLabelByKey,
    hideEmptySessions,
    showAutomatedRuns
  }: AiVaultSessionFilterState & { showAutomatedRuns: boolean }
) {
  const inScopeSessions = useMemo(
    () =>
      searching
        ? sessions
        : filterAiVaultSessions(sessions, {
            query,
            agents,
            scope,
            sort,
            activeWorktreePaths,
            excludedWorktreePaths,
            activeProjectKey,
            sessionProjectById,
            projectLabelByKey,
            hideEmptySessions
          }),
    [
      searching,
      sessions,
      query,
      agents,
      scope,
      sort,
      activeWorktreePaths,
      excludedWorktreePaths,
      activeProjectKey,
      sessionProjectById,
      projectLabelByKey,
      hideEmptySessions
    ]
  )
  // Why: search hits are counted and hidden the same way, so the switch means one thing everywhere.
  const { sessions: filteredSessions, automatedRunCount } = useMemo(
    () => applyAiVaultAutomatedRunsSwitch(inScopeSessions, showAutomatedRuns),
    [inScopeSessions, showAutomatedRuns]
  )
  const groups = useMemo<AiVaultSessionListGroup[]>(
    () =>
      searching
        ? filteredSessions.length === 0
          ? []
          : // The results bar above the list carries the count, so this group only holds rows.
            [{ key: 'search-results', label: null, sessions: [...filteredSessions] }]
        : groupAiVaultSessions(filteredSessions, group, { sessionProjectById, projectLabelByKey }),
    [searching, filteredSessions, group, projectLabelByKey, sessionProjectById]
  )
  return { filteredSessions, groups, automatedRunCount }
}

/** A session's agent name: a Pi session names the runtime its own transcript lives under. */
export function aiVaultSessionAgentLabel(
  session: Pick<AiVaultSession, 'agent' | 'filePath'>
): string {
  return session.agent === 'pi'
    ? piRuntimeLabel(piRuntimeForSessionFilePath(session.filePath))
    : sharedAgentLabel(session.agent)
}

/** An agent's name in a list of agents, named by the workspace's Pi runtime for Pi. */
export function aiVaultAgentDisplayLabel(agent: AiVaultAgent, piRuntime: PiDisplayRuntime): string {
  return agent === 'pi' ? piRuntimeLabel(piRuntime) : sharedAgentLabel(agent)
}
