import type React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { OneLineChildDisclosure, OneLineSessionRow } from './worktree-card-one-line-session-row'

vi.mock('./worktree-card-one-line-session-hover', () => ({
  OneLineSessionHover: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('./worktree-card-one-line-session-menu', () => ({
  OneLineSessionMenu: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => undefined }))
vi.mock('@/components/dashboard/use-agent-row-conversation-name', () => ({
  useAgentRowConversationName: () => 'Plan de exploración'
}))
vi.mock('@/store', () => ({ useAppStore: () => () => {} }))

function parent(): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the row reads only these fields.
  return {
    paneKey: 'parent',
    tab: { id: 'tab-1', worktreeId: 'wt-1' },
    agentType: 'claude',
    state: 'idle',
    startedAt: 1,
    entry: { prompt: 'plan', state: 'idle', stateStartedAt: 1, paneKey: 'parent', updatedAt: 1 }
  } as unknown as DashboardAgentRow
}

function renderRow(expanded: boolean): string {
  return renderToStaticMarkup(
    <OneLineSessionRow
      agent={parent()}
      now={1000}
      glyph={null}
      isUnvisited={false}
      isFocusedPane={false}
      dimmed={false}
      onActivate={() => {}}
      childAgentCount={1}
      childAgentsExpanded={expanded}
      onToggleChildAgents={() => {}}
    />
  )
}

describe('a folded parent session in the one-line sidebar', () => {
  it('reveals its chevron on hover, so it can be unfolded again', () => {
    const markup = renderRow(false)

    // The stylesheet hides a folded parent's chevron until its agent-disclosure-row is hovered.
    expect(markup).toMatch(
      /class="[^"]*\bagent-disclosure-row\b[^"]*"[^>]*data-one-line-session-row/
    )
    expect(markup).toContain('data-agent-child-disclosure-button')
    expect(markup).toContain('aria-expanded="false"')
  })

  it('puts the hidden-children count in the chevron hit target', () => {
    const markup = renderToStaticMarkup(
      <OneLineChildDisclosure count={1} expanded={false} onToggle={() => {}} />
    )

    expect(markup).toMatch(/agent-child-disclosure-time[^>]*><span[^>]*>\+1<\/span>/)
  })

  it('drops the count once the children show', () => {
    expect(renderRow(true)).not.toContain('+1')
  })
})
