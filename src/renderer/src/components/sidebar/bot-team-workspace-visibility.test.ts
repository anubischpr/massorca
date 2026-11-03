import { describe, expect, it } from 'vitest'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { computeVisibleWorktreeIds } from './visible-worktrees'
import {
  isBotTeamFolderVisibleInWorkspaces,
  visibleSessionAgents,
  worktreeIdsHostingBotTeamSessions
} from './bot-team-workspace-visibility'

const TEAM_ID = 'team-a'
const TEAM_FOLDER = '/home/me/MassOrca Bot Teams/team-a/repo'
const team = { teamId: TEAM_ID, teamName: 'Team A', character: 'square' as const }

describe('isBotTeamFolderVisibleInWorkspaces', () => {
  it('shows an ordinary folder whatever the switch says', () => {
    expect(isBotTeamFolderVisibleInWorkspaces('/home/me/project', new Set(), false)).toBe(true)
  })

  it('hides a team folder while Show bot teams is off, even when its team has Workspaces on', () => {
    expect(isBotTeamFolderVisibleInWorkspaces(TEAM_FOLDER, new Set([TEAM_ID]), false)).toBe(false)
  })

  it('shows a team folder only with the switch on and its team Workspaces option on', () => {
    expect(isBotTeamFolderVisibleInWorkspaces(TEAM_FOLDER, new Set([TEAM_ID]), true)).toBe(true)
    expect(isBotTeamFolderVisibleInWorkspaces(TEAM_FOLDER, new Set(), true)).toBe(false)
  })
})

describe('worktreeIdsHostingBotTeamSessions', () => {
  it('names only the worktrees whose agent-session tab runs a team session', () => {
    const tabs = {
      'wt-task': [{ id: 'tab-1', contentType: 'agent-session', entityId: 'session-1' }],
      'wt-user': [{ id: 'tab-2', contentType: 'agent-session', entityId: 'session-2' }],
      'wt-terminal': [{ id: 'tab-3', contentType: 'terminal', entityId: 'session-1' }]
    }
    expect([...worktreeIdsHostingBotTeamSessions(tabs, { 'session-1': team })]).toEqual(['wt-task'])
  })
})

describe('visibleSessionAgents', () => {
  const agents = [{ tab: { id: 'tab-1' } }, { tab: { id: 'tab-2' } }]
  const botTeamByTabId = { 'tab-1': team }

  it('drops team sessions while Show bot teams is off', () => {
    expect(visibleSessionAgents(agents, botTeamByTabId, false)).toEqual([agents[1]])
  })

  it('keeps every session while Show bot teams is on', () => {
    expect(visibleSessionAgents(agents, botTeamByTabId, true)).toEqual(agents)
  })
})

describe('computeVisibleWorktreeIds with bot-team workspaces', () => {
  const repoMap = new Map<string, Repo>([
    [
      'repo1',
      { id: 'repo1', path: '/repo1', displayName: 'Repo 1', badgeColor: '#000', addedAt: 0 }
    ]
  ])

  function worktree(id: string, path: string, isMainWorktree = false): Worktree {
    return {
      id,
      repoId: 'repo1',
      path,
      head: 'abc123',
      branch: 'refs/heads/main',
      isBare: false,
      isMainWorktree,
      displayName: id,
      comment: '',
      linkedIssue: null,
      linkedPR: null,
      linkedLinearIssue: null,
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0
    } as Worktree
  }

  const worktreesByRepo = {
    repo1: [
      worktree('main', '/home/me/project', true),
      worktree('team-folder', TEAM_FOLDER, true),
      worktree('bot-child', '/home/me/project-worktrees/bot-child'),
      worktree('user-child', '/home/me/project-worktrees/user-child')
    ]
  }
  const sortedIds = ['main', 'team-folder', 'bot-child', 'user-child']

  function visibleIds(overrides: Record<string, unknown>): string[] {
    return computeVisibleWorktreeIds(worktreesByRepo, sortedIds, {
      filterRepoIds: [],
      showSleepingWorkspaces: true,
      tabsByWorktree: {},
      ptyIdsByTabId: {},
      browserTabsByWorktree: {},
      worktreeIdsWithLiveAgent: new Set(),
      hideDefaultBranchWorkspace: false,
      hideAutomationGeneratedWorkspaces: false,
      hideCliCreatedWorkspaces: false,
      hideDetachedHeadWorkspaces: false,
      hideWorkspacesFromOtherDevices: false,
      pairedDeviceIdsByEnvironment: new Map(),
      repoMap,
      workspaceHostScope: 'all',
      defaultHostId: LOCAL_EXECUTION_HOST_ID,
      worktreeLineageById: {},
      botTeamWorkspaceIds: new Set([TEAM_ID]),
      botTeamWorktreeIds: new Set(['bot-child', 'main']),
      ...overrides
    } as Parameters<typeof computeVisibleWorktreeIds>[2])
  }

  it('hides team folders and bot-created child worktrees while Show bot teams is off', () => {
    expect(visibleIds({ showBotTeamWorkspaces: false })).toEqual(['main', 'user-child'])
  })

  it('shows team folders and bot-created child worktrees while Show bot teams is on', () => {
    expect(visibleIds({ showBotTeamWorkspaces: true })).toEqual([
      'main',
      'team-folder',
      'bot-child',
      'user-child'
    ])
  })

  it('keeps a main checkout visible while Show bot teams is off, even when a team session runs in it', () => {
    expect(visibleIds({ showBotTeamWorkspaces: false })).toContain('main')
  })

  it('keeps a team folder hidden with the switch on when its team Workspaces option is off', () => {
    expect(
      visibleIds({ showBotTeamWorkspaces: true, botTeamWorkspaceIds: new Set() })
    ).not.toContain('team-folder')
  })
})
