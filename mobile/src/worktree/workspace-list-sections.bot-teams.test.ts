import { afterEach, describe, expect, it } from 'vitest'
import {
  setMobileBotTeamSessionTeams,
  setMobileBotTeamShown
} from '../bot-teams/mobile-bot-team-session-team-visibility'
import { filterWorktrees } from './workspace-list-sections'
import type { FilterState, Worktree } from './workspace-list-types'

const TEAM = { teamId: 'team-a', teamName: 'Team A', character: 'square' as const }
const FILTERS: FilterState = {
  filterRepoIds: new Set(),
  hideSleeping: false,
  hideDefaultBranch: false
}

function worktree(id: string, overrides: Partial<Worktree> = {}): Worktree {
  return {
    worktreeId: id,
    repoId: 'repo1',
    repo: 'Repo 1',
    branch: 'feature',
    displayName: id,
    path: `/home/me/project-worktrees/${id}`,
    liveTerminalCount: 0,
    hasAttachedPty: false,
    preview: '',
    unread: false,
    isPinned: false,
    linkedPR: null,
    ...overrides
  } as Worktree
}

const teamFolder = worktree('team-folder', {
  path: '/home/me/MassOrca Bot Teams/team-a/repo',
  isMainWorktree: true
})
const main = worktree('main', { path: '/home/me/project', isMainWorktree: true })
const botChild = worktree('bot-child', {
  agents: [
    {
      paneKey: 'structured-agent-session-claude_1:leaf',
      parentPaneKey: null,
      state: 'done'
    } as never
  ]
})
const userChild = worktree('user-child')
// A user's worktree that lists a team session which runs in its child worktree stays visible.
const userParent = worktree('user-parent', {
  agents: [
    {
      paneKey: 'structured-agent-session-claude_1:leaf',
      parentPaneKey: null,
      state: 'done'
    } as never,
    {
      paneKey: 'structured-agent-session-claude_9:leaf',
      parentPaneKey: null,
      state: 'done'
    } as never
  ]
})
const all = [teamFolder, main, botChild, userChild, userParent]

describe('filterWorktrees with bot-team workspaces', () => {
  afterEach(() => {
    setMobileBotTeamShown(false)
    setMobileBotTeamSessionTeams({})
  })

  it('hides team folders and bot-created worktrees while Show bot teams is off', () => {
    setMobileBotTeamSessionTeams({ claude_1: TEAM })
    expect(filterWorktrees(all, FILTERS, '').map((w) => w.worktreeId)).toEqual([
      'main',
      'user-child',
      'user-parent'
    ])
  })

  it('shows them while Show bot teams is on', () => {
    setMobileBotTeamSessionTeams({ claude_1: TEAM })
    setMobileBotTeamShown(true)
    expect(filterWorktrees(all, FILTERS, '').map((w) => w.worktreeId)).toEqual([
      'team-folder',
      'main',
      'bot-child',
      'user-child',
      'user-parent'
    ])
  })
})
