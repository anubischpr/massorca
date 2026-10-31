import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { CrossWorktreeBranchIcon } from './worktree-card-one-line-cross-worktree-branch'
import { crossWorktreeBranchOf, oneLineRowDimmed } from './worktree-card-one-line-sessions'
import { getSessionMenuKind } from './worktree-card-one-line-session-menu'

function makeRow(overrides?: Partial<DashboardAgentRow>): DashboardAgentRow {
  const row = {
    paneKey: 'tab-b:leaf',
    tab: { id: 'tab-b', worktreeId: 'wt-b' },
    agentType: 'claude',
    state: 'working',
    startedAt: 1,
    entry: {},
    ...overrides
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the helpers under test read only paneKey, tab, rowSource, lineage and crossWorktree.
  return row as unknown as DashboardAgentRow
}

describe('cross-worktree child session row', () => {
  it('names the branch in the branch icon tooltip', () => {
    const markup = renderToStaticMarkup(<CrossWorktreeBranchIcon branch="feature/x" />)

    expect(markup).toContain('title="Runs on branch feature/x"')
    expect(markup).toContain('data-cross-worktree-branch=""')
  })

  it('dims a child session by the host of the worktree it runs in, not the card host', () => {
    const child = makeRow({ crossWorktree: true })

    expect(oneLineRowDimmed(child, false, { 'wt-b': true })).toBe(true)
    expect(oneLineRowDimmed(child, true, { 'wt-b': false })).toBe(false)
    expect(oneLineRowDimmed(makeRow(), true, { 'wt-b': false })).toBe(true)
    expect(oneLineRowDimmed(makeRow(), false, { 'wt-b': true })).toBe(false)
  })

  it('gives the branch icon to a child session only, never to its subagent rows', () => {
    const child = makeRow({ crossWorktree: true })
    const subagent = makeRow({ crossWorktree: true, rowSource: 'subagent' })

    expect(crossWorktreeBranchOf(child, { 'wt-b': 'feature/x' })).toBe('feature/x')
    expect(crossWorktreeBranchOf(subagent, { 'wt-b': 'feature/x' })).toBeUndefined()
    expect(crossWorktreeBranchOf(makeRow(), { 'wt-b': 'feature/x' })).toBeUndefined()
    expect(crossWorktreeBranchOf(child, { 'wt-b': '' })).toBeUndefined()
  })

  it('offers a child session in another worktree the actions of a subagent child', () => {
    expect(getSessionMenuKind(makeRow({ crossWorktree: true }))).toEqual({
      ownsTab: false,
      hasPane: false
    })
    expect(getSessionMenuKind(makeRow())).toEqual({ ownsTab: true, hasPane: true })
  })
})
