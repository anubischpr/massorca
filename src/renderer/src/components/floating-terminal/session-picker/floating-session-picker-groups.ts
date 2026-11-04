import type { AgentType } from '../../../../../shared/agent-status-types'
import type { TabContentType } from '../../../../../shared/tab-types'
import { translate } from '@/i18n/i18n'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import type { WorktreeRuntimeOwnerState } from '@/lib/worktree-runtime-owner'
import {
  runtimeHostConnectionStateForEntry,
  type RuntimeHostConnectionState
} from '@/runtime/runtime-host-connection-state'
import type { AppState } from '@/store/types'
import {
  listOtherWorkspaceSessionGroups,
  type OtherWorkspacesState
} from '../../tab-group/session-picker-pane'

export type FloatingSessionCandidate = {
  tabId: string
  worktreeId: string
  /** The host session id a chat tab carries; null for a session tab that has none (an agent terminal). */
  sessionId: string | null
  label: string
  agent: AgentType | undefined
  contentType: TabContentType
}

export type FloatingSessionGroup = {
  worktreeId: string
  /** The sidebar's "repo / workspace" heading. */
  heading: string
  /** The paired host's name, or "This computer". */
  hostLabel: string
  hostState: RuntimeHostConnectionState
  candidates: FloatingSessionCandidate[]
}

export type FloatingSessionPickerState = OtherWorkspacesState &
  WorktreeRuntimeOwnerState &
  Pick<AppState, 'runtimeEnvironments' | 'runtimeStatusByEnvironmentId'>

export type FloatingSessionPickerOptions = {
  /** The floating layout's own workspace, whose sessions are never offered. */
  layoutWorktreeId: string
  /** Also offer a session some pane already shows; a reader leaves it where it is. */
  includeReferenced?: boolean
  /** Keeps a candidate in the list, such as only the sessions that have a checklist. */
  accept?: (candidate: FloatingSessionCandidate) => boolean
}

/**
 * Sessions of every workspace the app lists, grouped like the Workspaces sidebar and labelled with
 * the host that owns each workspace. Reuses the split-view picker's grouping rather than copying it.
 */
export function listFloatingSessionPickerGroups(
  state: FloatingSessionPickerState,
  options: FloatingSessionPickerOptions
): FloatingSessionGroup[] {
  const groups = listOtherWorkspaceSessionGroups(state, options.layoutWorktreeId, {
    includeReferenced: options.includeReferenced
  })
  const result: FloatingSessionGroup[] = []
  for (const group of groups) {
    const tabs = state.unifiedTabsByWorktree[group.worktreeId] ?? []
    const candidates = group.candidates.flatMap((candidate): FloatingSessionCandidate[] => {
      const tab = tabs.find((row) => row.id === candidate.tabId)
      if (!tab) {
        return []
      }
      const described: FloatingSessionCandidate = {
        tabId: tab.id,
        worktreeId: group.worktreeId,
        sessionId: tab.contentType === 'agent-session' ? tab.entityId : null,
        label: candidate.label,
        agent: tab.agentSessionAgent,
        contentType: tab.contentType
      }
      return options.accept && !options.accept(described) ? [] : [described]
    })
    if (candidates.length === 0) {
      continue
    }
    const environmentId = getRuntimeEnvironmentIdForWorktree(state, group.worktreeId)
    const environments: readonly { id: string; name: string }[] = state.runtimeEnvironments
    const environment = environmentId
      ? environments.find((entry) => entry.id === environmentId)
      : undefined
    result.push({
      worktreeId: group.worktreeId,
      heading: group.heading,
      hostLabel:
        environmentId === null
          ? translate('components.floatingSessionPicker.thisComputer', 'This computer')
          : (environment?.name ?? environmentId),
      hostState:
        environmentId === null
          ? 'connected'
          : runtimeHostConnectionStateForEntry(
              state.runtimeStatusByEnvironmentId.get(environmentId)
            ),
      candidates
    })
  }
  return result
}
