import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { OneLineSessionTree, type OneLineSessionTreeProps } from './worktree-card-one-line-sessions'

vi.mock('./worktree-card-one-line-session-row', () => ({
  OneLineSessionRow: (props: {
    agent: DashboardAgentRow
    glyph: string | null
    dimmed: boolean
  }) => (
    <div
      data-row={props.agent.paneKey}
      data-glyph={props.glyph ?? ''}
      data-dimmed={String(props.dimmed)}
    />
  )
}))

// A crash-cut main agent is how a row reads as failed: the row state itself never says so.
const CRASH_CUT = { state: 'done', outcome: 'interruption', stateStartedAt: 1 }

function makeAgent(paneKey: string, state: string, mainAgent?: object): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only the fields set here.
  return {
    paneKey,
    tab: { id: 'tab-1' },
    agentType: 'claude',
    state,
    startedAt: 1,
    entry: { prompt: paneKey, state, stateStartedAt: 1, paneKey, updatedAt: 1, mainAgent }
  } as unknown as DashboardAgentRow
}

function renderTree(
  agents: DashboardAgentRow[],
  overrides: Partial<OneLineSessionTreeProps> = {}
): string {
  return renderToStaticMarkup(
    <OneLineSessionTree
      rootAgents={agents}
      childrenByParentPaneKey={new Map()}
      collapsedLineageParents={new Set()}
      unvisitedByPaneKey={{}}
      now={1000}
      focusedAgentPaneKey={null}
      dimmed={false}
      allSessionsShown={false}
      onToggleAllSessionsShown={() => {}}
      onToggleLineageParent={() => {}}
      onActivate={() => {}}
      onActivateRetained={() => {}}
      {...overrides}
    />
  )
}

function rowsIn(markup: string): string[] {
  return [...markup.matchAll(/data-row="([^"]+)"/g)].map((match) => match[1])
}

const idleSessions = (count: number): DashboardAgentRow[] =>
  Array.from({ length: count }, (_, index) => makeAgent(`s${index + 1}`, 'idle'))

describe('OneLineSessionTree', () => {
  it('shows five sessions and folds the rest behind a count', () => {
    const markup = renderTree(idleSessions(8))

    expect(rowsIn(markup)).toEqual(['s1', 's2', 's3', 's4', 's5'])
    expect(markup).toContain('Show 3 more')
  })

  it('shows every session when five or fewer exist', () => {
    const markup = renderTree(idleSessions(5))

    expect(rowsIn(markup)).toHaveLength(5)
    expect(markup).not.toContain('data-one-line-show-more')
  })

  it('never hides a session that needs the user, is failing or is working', () => {
    const agents = idleSessions(10)
    agents[6] = makeAgent('s7', 'blocked')
    agents[7] = makeAgent('s8', 'working')
    agents[8] = makeAgent('s9', 'done', CRASH_CUT)

    const rows = rowsIn(renderTree(agents))

    expect(rows).toContain('s7')
    expect(rows).toContain('s8')
    expect(rows).toContain('s9')
    expect(rows).toEqual(['s1', 's2', 's7', 's8', 's9'])
  })

  it('never hides an unread session', () => {
    const agents = idleSessions(8)
    const rows = rowsIn(renderTree(agents, { unvisitedByPaneKey: { s8: true } }))

    expect(rows).toContain('s8')
  })

  it('reveals the folded sessions on request and offers to fold them again', () => {
    const markup = renderTree(idleSessions(8), { allSessionsShown: true })

    expect(rowsIn(markup)).toHaveLength(8)
    expect(markup).toContain('Show less')
  })

  it('lets a folded parent speak for its hidden children', () => {
    const parent = makeAgent('parent', 'idle')
    const quietChild = makeAgent('child-quiet', 'idle')
    const askingChild = makeAgent('child-asking', 'blocked')
    const markup = renderTree([parent], {
      childrenByParentPaneKey: new Map([['parent', [quietChild, askingChild]]]),
      collapsedLineageParents: new Set(['parent'])
    })

    expect(rowsIn(markup)).toEqual(['parent'])
    expect(markup).toContain('data-glyph="needs-human"')
  })

  it('keeps the parent urgent when only a folded child needs the user', () => {
    const agents = idleSessions(8)
    const askingChild = makeAgent('child-asking', 'blocked')
    const markup = renderTree(agents, {
      childrenByParentPaneKey: new Map([['s8', [askingChild]]]),
      collapsedLineageParents: new Set(['s8'])
    })

    expect(rowsIn(markup)).toContain('s8')
  })

  it('shows children under an open parent', () => {
    const markup = renderTree([makeAgent('parent', 'working')], {
      childrenByParentPaneKey: new Map([['parent', [makeAgent('child', 'working')]]])
    })

    expect(rowsIn(markup)).toEqual(['parent', 'child'])
    expect(markup).toContain('worktree-agent-lineage-children')
  })

  it('passes a lost-contact host on to the rows so they dim', () => {
    const markup = renderTree(idleSessions(1), { dimmed: true })

    expect(markup).toContain('data-dimmed="true"')
  })
})
