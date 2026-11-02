import { describe, expect, it } from 'vitest'
import {
  canShowRightSidebarForView,
  rightSidebarOpenInView,
  rightSidebarShowsPullRequestData
} from './right-sidebar-visibility'
import type { AppState } from '@/store/types'

function makeState(
  overrides: Partial<Parameters<typeof rightSidebarShowsPullRequestData>[0]> = {}
): Parameters<typeof rightSidebarShowsPullRequestData>[0] {
  return {
    activeView: 'terminal',
    activeWorktreeId: 'wt-1',
    repos: [
      {
        id: 'repo-1',
        path: '/repo',
        displayName: 'Repo',
        badgeColor: '#000000',
        addedAt: 1,
        kind: 'git'
      }
    ],
    rightSidebarOpen: true,
    rightSidebarTab: 'checks',
    worktreesByRepo: { 'repo-1': [{ id: 'wt-1', repoId: 'repo-1' }] },
    ...overrides
  } as Parameters<typeof rightSidebarShowsPullRequestData>[0]
}

const NO_TEAM = { teamId: null, taskId: null, creating: false }

describe('right sidebar visibility helpers', () => {
  it('suppresses right sidebar controls on full-page views', () => {
    for (const view of [
      'settings',
      'tasks',
      'activity',
      'automations',
      'space',
      'skills',
      'artifacts',
      'mobile'
    ]) {
      expect(canShowRightSidebarForView(view as AppState['activeView'], NO_TEAM)).toBe(false)
    }
  })

  it('allows right sidebar controls on workspace views', () => {
    expect(canShowRightSidebarForView('terminal', NO_TEAM)).toBe(true)
  })

  it('does not treat hidden full-page sidebars as visible PR panels', () => {
    expect(rightSidebarShowsPullRequestData(makeState({ activeView: 'tasks' }))).toBe(false)
  })

  it('does not treat hidden folder-repo fallbacks as visible PR panels', () => {
    expect(
      rightSidebarShowsPullRequestData(
        makeState({
          repos: [
            {
              id: 'repo-1',
              path: '/repo',
              displayName: 'Repo',
              badgeColor: '#000000',
              addedAt: 1,
              kind: 'folder'
            }
          ]
        })
      )
    ).toBe(false)
  })

  it('detects visible PR panels in workspace views', () => {
    expect(
      rightSidebarShowsPullRequestData(
        makeState({
          rightSidebarTab: 'source-control'
        })
      )
    ).toBe(true)
  })
})

describe('the right sidebar in Bot teams', () => {
  it('shows only in an open Conference room', () => {
    expect(canShowRightSidebarForView('bot-teams', NO_TEAM)).toBe(false)
    expect(canShowRightSidebarForView('bot-teams', { ...NO_TEAM, creating: true })).toBe(false)
    expect(canShowRightSidebarForView('bot-teams', { ...NO_TEAM, teamId: 't' })).toBe(true)
    expect(canShowRightSidebarForView('bot-teams', { ...NO_TEAM, teamId: 't', taskId: 'x' })).toBe(
      false
    )
  })

  it('keeps its open state apart from a workspace', () => {
    const state = { rightSidebarOpen: false, botTeamsPanelOpen: true }
    expect(rightSidebarOpenInView({ ...state, activeView: 'bot-teams' })).toBe(true)
    expect(rightSidebarOpenInView({ ...state, activeView: 'terminal' })).toBe(false)
  })
})
