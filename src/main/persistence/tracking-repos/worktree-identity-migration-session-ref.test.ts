import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState, getDefaultWorkspaceSession } from '../../../shared/constants'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { TabGroup } from '../../../shared/tab-types'
import { migrateWorktreeIdentity } from './worktree-identity-migration'

const OLD = 'repo::/old/path'
const NEW = 'repo::/new/path'
const SHOWING = 'repo::/showing'
const OTHER = 'repo::/other'

function stateWithGroups(groupsByWorktree: Record<string, TabGroup[]>): PersistedState {
  return {
    ...getDefaultPersistedState('/home'),
    workspaceSession: { ...getDefaultWorkspaceSession(), tabGroups: groupsByWorktree }
  }
}

function refPane(id: string, worktreeId: string, target: string): TabGroup {
  return {
    id,
    worktreeId,
    activeTabId: null,
    tabOrder: [],
    sessionRef: { worktreeId: target, tabId: 'session-tab' }
  }
}

describe('renaming a worktree id while a pane shows one of its sessions', () => {
  it('points the reference at the new id', () => {
    const state = stateWithGroups({ [SHOWING]: [refPane('pane', SHOWING, OLD)] })
    expect(migrateWorktreeIdentity(state, OLD, NEW)).toBe(true)
    expect(state.workspaceSession.tabGroups?.[SHOWING][0].sessionRef).toEqual({
      worktreeId: NEW,
      tabId: 'session-tab'
    })
  })

  it('renames the pane’s own workspace without touching the workspace it shows', () => {
    const state = stateWithGroups({ [OLD]: [refPane('pane', OLD, OTHER)] })
    migrateWorktreeIdentity(state, OLD, NEW)
    const [pane] = state.workspaceSession.tabGroups?.[NEW] ?? []
    expect(pane.worktreeId).toBe(NEW)
    expect(pane.sessionRef?.worktreeId).toBe(OTHER)
  })

  it('leaves a reference to an unrelated workspace alone', () => {
    const state = stateWithGroups({ [SHOWING]: [refPane('pane', SHOWING, OTHER)] })
    expect(migrateWorktreeIdentity(state, OLD, NEW)).toBe(false)
    expect(state.workspaceSession.tabGroups?.[SHOWING][0].sessionRef?.worktreeId).toBe(OTHER)
  })
})
