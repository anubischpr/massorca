import { describe, expect, it } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import {
  arrangeBranchRowSections,
  placeCrossWorktreeAgents
} from './cross-worktree-agent-placement'
import { getWorktreeRowIdentity } from './worktree-host-row-identity'
import type { Section, Worktree } from './workspace-list-types'

function agent(paneKey: string, parentPaneKey: string | null = null): RuntimeWorktreeAgentRow {
  return {
    paneKey,
    parentPaneKey,
    state: 'working',
    agentType: 'claude',
    prompt: '',
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 1,
    updatedAt: 1
  }
}

function worktree(
  worktreeId: string,
  branch: string,
  agents: RuntimeWorktreeAgentRow[] = [],
  extra: Partial<Worktree> = {}
): Worktree {
  return {
    worktreeId,
    repoId: 'repo',
    repo: 'app',
    branch,
    displayName: worktreeId,
    path: `/work/${worktreeId}`,
    liveTerminalCount: 0,
    hasAttachedPty: false,
    preview: '',
    unread: false,
    isPinned: false,
    linkedPR: null,
    agents,
    ...extra
  }
}

function section(key: string, data: Worktree[]): Section {
  return { key, title: key, data }
}

function listedPaneKeys(sections: readonly Section[]): string[] {
  return sections
    .flatMap((entry) => entry.data.flatMap((item) => item.agents ?? []))
    .map((row) => row.paneKey)
    .sort()
}

describe('placeCrossWorktreeAgents', () => {
  it('lists a session under its parent in another worktree, once, and drops it from its own', () => {
    const child = worktree('w2', 'refs/heads/feature/x', [agent('tab-c:0', 'tab-p:0')])
    const sections = [section('all', [worktree('w1', 'main', [agent('tab-p:0')]), child])]

    const { sections: placed, ownersByPaneKey } = placeCrossWorktreeAgents(sections)

    expect(placed[0]?.data[0]?.agents?.map((row) => row.paneKey)).toEqual(['tab-p:0', 'tab-c:0'])
    expect(placed[0]?.data[1]?.agents).toEqual([])
    expect(ownersByPaneKey.get('tab-c:0')).toEqual({ item: child, branch: 'feature/x' })
  })

  it('leaves a session in its own worktree when its parent is listed there too', () => {
    const own = worktree('w1', 'main', [agent('tab-p:0'), agent('tab-c:0', 'tab-p:0')])
    const sections = [section('all', [own])]

    const { sections: placed, ownersByPaneKey } = placeCrossWorktreeAgents(sections)

    expect(placed[0]?.data[0]).toBe(own)
    expect(ownersByPaneKey.size).toBe(0)
  })

  it('keeps an orphan session as a root in its own worktree', () => {
    const orphan = worktree('w2', 'feature/x', [agent('tab-c:0', 'tab-missing:0')])
    const sections = [section('all', [worktree('w1', 'main', [agent('tab-p:0')]), orphan])]

    const { sections: placed, ownersByPaneKey } = placeCrossWorktreeAgents(sections)

    expect(placed[0]?.data[1]).toBe(orphan)
    expect(ownersByPaneKey.size).toBe(0)
  })

  it('follows the parent chain to the worktree where it ends', () => {
    const sections = [
      section('all', [
        worktree('w1', 'main', [agent('tab-p:0')]),
        worktree('w2', 'feature/middle', [agent('tab-m:0', 'tab-p:0')]),
        worktree('w3', 'feature/leaf', [agent('tab-c:0', 'tab-m:0')])
      ])
    ]

    const { sections: placed, ownersByPaneKey } = placeCrossWorktreeAgents(sections)

    expect(placed[0]?.data[0]?.agents?.map((row) => row.paneKey)).toEqual([
      'tab-p:0',
      'tab-m:0',
      'tab-c:0'
    ])
    expect(ownersByPaneKey.get('tab-m:0')?.branch).toBe('feature/middle')
    expect(ownersByPaneKey.get('tab-c:0')?.branch).toBe('feature/leaf')
    expect(placed[0]?.data[1]?.agents).toEqual([])
    expect(placed[0]?.data[2]?.agents).toEqual([])
  })

  it('lists each session of a cycle once and keeps the cycle from looping', () => {
    const sections = [
      section('all', [
        worktree('w1', 'main', [agent('tab-a:0', 'tab-b:0')]),
        worktree('w2', 'feature/y', [agent('tab-b:0', 'tab-a:0')])
      ])
    ]

    const { sections: placed } = placeCrossWorktreeAgents(sections)

    expect(listedPaneKeys(placed)).toEqual(['tab-a:0', 'tab-b:0'])
  })

  it('gives a folder or a detached owner no branch to name', () => {
    const folder = worktree('f1', '', [agent('tab-c:0', 'tab-p:0')], {
      workspaceKind: 'folder-workspace'
    })
    const detached = worktree('w3', '', [agent('tab-d:0', 'tab-p:0')])
    const sections = [
      section('all', [worktree('w1', 'main', [agent('tab-p:0')]), folder, detached])
    ]

    const { ownersByPaneKey } = placeCrossWorktreeAgents(sections)

    expect(ownersByPaneKey.get('tab-c:0')).toEqual({ item: folder, branch: null })
    expect(ownersByPaneKey.get('tab-d:0')).toEqual({ item: detached, branch: null })
  })

  it('attaches the children once when the parent worktree is listed twice', () => {
    const parent = worktree('w1', 'main', [agent('tab-p:0')])
    const sections = [
      section('pinned', [parent]),
      section('repo:app', [parent, worktree('w2', 'feature/x', [agent('tab-c:0', 'tab-p:0')])])
    ]

    const { sections: placed } = placeCrossWorktreeAgents(sections)

    expect(placed[0]?.data[0]?.agents?.map((row) => row.paneKey)).toEqual(['tab-p:0', 'tab-c:0'])
    expect(placed[1]?.data[0]).toBe(parent)
    expect(listedPaneKeys(placed).filter((key) => key === 'tab-c:0')).toHaveLength(1)
  })
})

describe('branch rows of worktrees whose sessions run under another parent', () => {
  const A = worktree('wt-a', 'main', [agent('pane-p')])
  const B = worktree('wt-b', 'feature', [agent('pane-c', 'pane-p')], { parentWorktreeId: 'wt-a' })
  const identityOf = (item: Worktree) => getWorktreeRowIdentity(item)

  it('hides the child row when its only session runs under a parent in another worktree', () => {
    const placement = placeCrossWorktreeAgents([section('all', [A, B])])

    expect([...placement.hiddenIdentities]).toEqual([identityOf(B)])
  })

  it('keeps the child row when it also lists a session of its own', () => {
    const extra = worktree('wt-b', 'feature', [agent('pane-c', 'pane-p'), agent('pane-own')], {
      parentWorktreeId: 'wt-a'
    })
    const placement = placeCrossWorktreeAgents([section('all', [A, extra])])

    expect(placement.hiddenIdentities.size).toBe(0)
  })

  it('keeps the child row, unplaced, when its parent session is gone', () => {
    const lonely = worktree('wt-b', 'feature', [agent('pane-c', 'pane-missing')])
    const placement = placeCrossWorktreeAgents([section('all', [A, lonely])])

    expect(placement.hiddenIdentities.size).toBe(0)
    expect(placement.ownersByPaneKey.has('pane-c')).toBe(false)
  })

  it('keeps the child row when its parent worktree is not in the list', () => {
    const placement = placeCrossWorktreeAgents([section('all', [B])])

    expect(placement.hiddenIdentities.size).toBe(0)
  })

  it('keeps the rows of a session loop', () => {
    const loopA = worktree('wt-a', 'main', [agent('pane-p', 'pane-c')])
    const loopB = worktree('wt-b', 'feature', [agent('pane-c', 'pane-p')])
    const placement = placeCrossWorktreeAgents([section('all', [loopA, loopB])])

    expect(placement.hiddenIdentities.size).toBe(0)
  })

  it('hides the middle of a nested chain and keeps the top-level parent', () => {
    const C = worktree('wt-c', 'nested', [agent('pane-g', 'pane-c')], { parentWorktreeId: 'wt-b' })
    const placement = placeCrossWorktreeAgents([section('all', [A, B, C])])

    expect([...placement.hiddenIdentities].sort()).toEqual([identityOf(B), identityOf(C)].sort())
  })

  it('marks a worktree with no session of its own as unnested when it has a lineage parent', () => {
    const empty = worktree('wt-b', 'feature', [], { parentWorktreeId: 'wt-a' })
    const placement = placeCrossWorktreeAgents([section('all', [A, empty])])

    expect(placement.unnestedIdentities.has(identityOf(empty))).toBe(true)
    expect(placement.unnestedIdentities.has(identityOf(A))).toBe(false)
  })

  it('removes a hidden row outside the pinned section and keeps it there', () => {
    const placement = placeCrossWorktreeAgents([section('all', [A, B]), section('pinned', [B])])
    const laidOut = arrangeBranchRowSections(placement.sections, placement, new Set())

    expect(laidOut.find((s) => s.key === 'all')?.data.map((item) => item.worktreeId)).toEqual([
      'wt-a'
    ])
    expect(laidOut.find((s) => s.key === 'pinned')?.data.map((item) => item.worktreeId)).toEqual([
      'wt-b'
    ])
  })
})
