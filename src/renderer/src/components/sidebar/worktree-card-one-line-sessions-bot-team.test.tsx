import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { OneLineSessionTree } from './worktree-card-one-line-sessions'

vi.mock('./worktree-card-one-line-session-row', () => ({
  OneLineSessionRow: (props: { agent: DashboardAgentRow; botTeam?: { teamName: string } }) => (
    <div data-row={props.agent.paneKey} data-bot-team={props.botTeam?.teamName ?? ''} />
  )
}))

function makeAgent(paneKey: string, tabId: string): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the tree reads only the fields set here.
  return {
    paneKey,
    tab: { id: tabId },
    agentType: 'claude',
    state: 'idle',
    startedAt: 1,
    entry: { prompt: paneKey, state: 'idle', stateStartedAt: 1, paneKey, updatedAt: 1 }
  } as unknown as DashboardAgentRow
}

describe('OneLineSessionTree bot-team characters', () => {
  it('hands each row the team of its session and nothing for other sessions', () => {
    const markup = renderToStaticMarkup(
      <OneLineSessionTree
        rootAgents={[makeAgent('s1', 'tab-bot'), makeAgent('s2', 'tab-plain')]}
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
        botTeamByTabId={{
          'tab-bot': { teamId: 't1', teamName: 'Marketing', character: 'circle' }
        }}
      />
    )

    expect(markup).toContain('data-row="s1" data-bot-team="Marketing"')
    expect(markup).toContain('data-row="s2" data-bot-team=""')
  })
})
