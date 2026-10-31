import { describe, expect, it } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import type { AgentDotState } from './agent-row-display'
import {
  buildSessionListView,
  isSessionGlyphUrgent,
  selectVisibleSessions,
  sessionStatusGlyph,
  VISIBLE_SESSION_LIMIT,
  worktreeStatusGlyph,
  worstSessionStatusGlyph
} from './session-status-glyph'

const NOW = 2_000

function agent(
  paneKey: string,
  overrides: Partial<RuntimeWorktreeAgentRow> = {},
  parentPaneKey: string | null = null
): RuntimeWorktreeAgentRow {
  return {
    paneKey,
    parentPaneKey,
    state: 'done',
    agentType: 'claude',
    prompt: `Prompt ${paneKey}`,
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 1_000,
    updatedAt: 1_000,
    ...overrides
  }
}

function quietRoots(count: number): RuntimeWorktreeAgentRow[] {
  return Array.from({ length: count }, (_, index) => agent(`quiet-${index + 1}`))
}

function paneKeys(rows: { agent: RuntimeWorktreeAgentRow }[]): string[] {
  return rows.map((row) => row.agent.paneKey)
}

describe('sessionStatusGlyph', () => {
  it.each([
    ['blocked', true, 'needs-human'],
    ['waiting', false, 'needs-human'],
    ['failed', false, 'failed'],
    ['working', false, 'working'],
    ['monitoring', false, 'monitoring'],
    ['unconfirmed', false, 'unconfirmed'],
    ['done', true, 'unread'],
    ['done', false, null],
    ['idle', true, 'unread'],
    ['idle', false, null],
    ['interrupted', false, null],
    ['interrupted', true, 'unread']
  ] as const)('maps %s (unvisited %s) to %s', (state: AgentDotState, unvisited, glyph) => {
    expect(sessionStatusGlyph(state, unvisited)).toBe(glyph)
  })
})

describe('worktreeStatusGlyph', () => {
  it('maps the host rollup, with monitoring for a working monitor', () => {
    expect(worktreeStatusGlyph('permission', false)).toBe('needs-human')
    expect(worktreeStatusGlyph('working', false)).toBe('working')
    expect(worktreeStatusGlyph('working', false, 'monitoring')).toBe('monitoring')
    expect(worktreeStatusGlyph('done', true)).toBe('unread')
    expect(worktreeStatusGlyph('active', true)).toBe('unread')
    expect(worktreeStatusGlyph('inactive', true)).toBe('unread')
    expect(worktreeStatusGlyph('done', false)).toBeNull()
    expect(worktreeStatusGlyph('active', false)).toBeNull()
  })
})

describe('worstSessionStatusGlyph', () => {
  it('ranks needs-human, then failed, working, monitoring, unconfirmed and unread', () => {
    expect(worstSessionStatusGlyph(['unread', 'working', 'failed', null])).toBe('failed')
    expect(worstSessionStatusGlyph(['unconfirmed', 'unread'])).toBe('unconfirmed')
    expect(worstSessionStatusGlyph(['monitoring', 'working'])).toBe('working')
    expect(worstSessionStatusGlyph(['needs-human', 'failed'])).toBe('needs-human')
  })

  it('is null when every row is quiet or there are no rows', () => {
    expect(worstSessionStatusGlyph([null, null])).toBeNull()
    expect(worstSessionStatusGlyph([])).toBeNull()
  })

  it('keeps an unconfirmed mark out of the urgent set', () => {
    expect(isSessionGlyphUrgent('unconfirmed')).toBe(false)
    expect(isSessionGlyphUrgent(null)).toBe(false)
    expect(isSessionGlyphUrgent('needs-human')).toBe(true)
    expect(isSessionGlyphUrgent('unread')).toBe(true)
  })
})

describe('selectVisibleSessions', () => {
  it('shows the first five quiet rows and folds the rest', () => {
    const rows = ['1', '2', '3', '4', '5', '6', '7']
    const { visible, hiddenCount } = selectVisibleSessions(rows, () => false)
    expect(visible).toEqual(['1', '2', '3', '4', '5'])
    expect(hiddenCount).toBe(2)
    expect(VISIBLE_SESSION_LIMIT).toBe(5)
  })

  it('keeps urgent rows past the limit, in their original order', () => {
    const rows = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'urgent']
    const { visible, hiddenCount } = selectVisibleSessions(rows, (row) => row === 'urgent')
    expect(visible).toEqual(['q1', 'q2', 'q3', 'q4', 'urgent'])
    expect(hiddenCount).toBe(2)
  })
})

describe('buildSessionListView hide rules', () => {
  const base = { now: NOW, unvisited: false, disconnected: false, allShown: false }

  it('shows five root sessions and folds the rest', () => {
    const view = buildSessionListView({ ...base, agents: quietRoots(7) })
    expect(paneKeys(view.rows)).toEqual(['quiet-1', 'quiet-2', 'quiet-3', 'quiet-4', 'quiet-5'])
    expect(view.hiddenCount).toBe(2)
    expect(view.rootCount).toBe(7)
    expect(view.worst).toBeNull()
  })

  it('never folds a needs-human session, even past the limit', () => {
    const agents = [...quietRoots(6), agent('waiting-root', { state: 'waiting', updatedAt: NOW })]
    const view = buildSessionListView({ ...base, agents })
    expect(paneKeys(view.rows)).toEqual([
      'quiet-1',
      'quiet-2',
      'quiet-3',
      'quiet-4',
      'waiting-root'
    ])
    expect(view.rows.at(-1)?.glyph).toBe('needs-human')
    expect(view.hiddenCount).toBe(2)
  })

  it('keeps a hidden root visible when one of its children needs attention', () => {
    const agents = [
      ...quietRoots(5),
      agent('parent', {}),
      agent('child', { state: 'waiting', updatedAt: NOW }, 'parent')
    ]
    const view = buildSessionListView({ ...base, agents })
    expect(paneKeys(view.rows)).toEqual([
      'quiet-1',
      'quiet-2',
      'quiet-3',
      'quiet-4',
      'parent',
      'child'
    ])
    expect(view.rows.map((row) => row.depth)).toEqual([0, 0, 0, 0, 0, 1])
    expect(view.hiddenCount).toBe(1)
  })

  it('shows every session once the user expands the list', () => {
    const view = buildSessionListView({ ...base, agents: quietRoots(7), allShown: true })
    expect(view.rows).toHaveLength(7)
    expect(view.hiddenCount).toBe(0)
  })

  it('shows the unconfirmed mark on every session of an unreachable host and folds them', () => {
    const agents = Array.from({ length: 7 }, (_, index) =>
      agent(`waiting-${index + 1}`, { state: 'waiting', updatedAt: NOW })
    )
    const view = buildSessionListView({ ...base, agents, disconnected: true })
    expect(view.rows).toHaveLength(5)
    expect(view.rows.every((row) => row.glyph === 'unconfirmed')).toBe(true)
    expect(view.hiddenCount).toBe(2)
  })

  it('reports the worst status across folded sessions for a collapsed branch', () => {
    // An unconfirmed verdict is not urgent, so this root folds behind five quiet ones.
    const unconfirmed = agent('unconfirmed-root', {
      mainAgent: { state: 'done', outcome: 'unconfirmed', stateStartedAt: 1_000 }
    })
    const view = buildSessionListView({ ...base, agents: [...quietRoots(5), unconfirmed] })
    expect(view.hiddenCount).toBe(1)
    expect(paneKeys(view.rows)).not.toContain('unconfirmed-root')
    expect(view.worst).toBe('unconfirmed')
  })
})

describe('failed state from the wire', () => {
  const base = { now: NOW, unvisited: false, disconnected: false, allShown: false }

  it('marks a session whose main agent failed', () => {
    const failed = agent('failed-root', {
      mainAgent: { state: 'done', outcome: 'failure', stateStartedAt: 1_000 }
    })
    const view = buildSessionListView({ ...base, agents: [failed] })
    expect(view.rows[0]?.glyph).toBe('failed')
  })

  it('shows no failed mark for an old host that sends no main-agent verdict', () => {
    const oldHost = agent('old-host-root')
    const view = buildSessionListView({ ...base, agents: [oldHost] })
    expect(view.rows[0]?.glyph).toBeNull()
  })
})
