import { describe, expect, it } from 'vitest'
import {
  mobileSessionSwitcherDot,
  mobileSessionSwitcherLabel,
  mobileSessionSwitcherRows,
  mobileChatSessionCount
} from './mobile-session-switcher-rows'

const tabs = [
  { id: 'chat', type: 'agent-session' as const },
  { id: 'shell', type: 'terminal' as const, terminal: 'handle-1' },
  {
    id: 'build',
    type: 'terminal' as const,
    terminal: 'handle-2',
    agentStatus: { state: 'working' as const }
  },
  { id: 'notes', type: 'markdown' as const }
]

function statusesOf(activeTabId: string, live: { working: boolean; waiting: boolean } | null) {
  return mobileSessionSwitcherRows(tabs, activeTabId, live).map((row) => [row.tab.id, row.status])
}

describe('mobileSessionSwitcherRows', () => {
  it('marks only the active tab and keeps every tab in order', () => {
    const rows = mobileSessionSwitcherRows(tabs, 'shell', null)
    expect(rows.map((row) => [row.tab.id, row.isActive])).toEqual([
      ['chat', false],
      ['shell', true],
      ['build', false],
      ['notes', false]
    ])
  })

  it('reports no status for document tabs', () => {
    expect(statusesOf('chat', null).at(-1)).toEqual(['notes', null])
  })

  it('reads the agent state a terminal tab reports, and a plain shell as running', () => {
    expect(statusesOf('chat', null)).toEqual([
      ['chat', 'idle'],
      ['shell', 'terminal'],
      ['build', 'working'],
      ['notes', null]
    ])
    const waiting = mobileSessionSwitcherRows(
      [{ id: 'a', type: 'terminal', terminal: 'h', agentStatus: { state: 'blocked' } }],
      null,
      null
    )
    expect(waiting[0].status).toBe('waiting')
  })

  it('shows an idle terminal that has no handle as idle', () => {
    const [row] = mobileSessionSwitcherRows(
      [{ id: 'gone', type: 'terminal', terminal: null }],
      null,
      null
    )
    expect(row.status).toBe('idle')
  })

  it('takes the live chat state for the active tab only, with waiting ahead of working', () => {
    expect(statusesOf('chat', { working: true, waiting: false })[0]).toEqual(['chat', 'working'])
    expect(statusesOf('chat', { working: true, waiting: true })[0]).toEqual(['chat', 'waiting'])
    // The live flags describe the chat, so they never restate another tab's status.
    expect(statusesOf('shell', { working: true, waiting: false })[0]).toEqual(['chat', 'idle'])
  })

  it('labels every status in the switcher vocabulary', () => {
    expect(mobileSessionSwitcherLabel('working')).toBe('Working')
    expect(mobileSessionSwitcherLabel('waiting')).toBe('Waiting for you')
    expect(mobileSessionSwitcherLabel('terminal')).toBe('Terminal running')
    expect(mobileSessionSwitcherLabel('idle')).toBe('Idle')
  })

  it('draws the waiting and working statuses as their own dots, and the rest as idle', () => {
    expect(mobileSessionSwitcherDot('working')).toBe('working')
    expect(mobileSessionSwitcherDot('waiting')).toBe('waiting')
    expect(mobileSessionSwitcherDot('terminal')).toBe('idle')
    expect(mobileSessionSwitcherDot('idle')).toBe('idle')
  })
})

describe('mobileChatSessionCount', () => {
  it('counts chats and leaves terminals, files and browsers out', () => {
    const rows = mobileSessionSwitcherRows(
      [
        { id: 'c1', type: 'agent-session' },
        { id: 't1', type: 'terminal' },
        { id: 't2', type: 'terminal' },
        { id: 'f1', type: 'file' },
        { id: 'c2', type: 'agent-session' }
      ],
      'c1',
      null
    )
    expect(mobileChatSessionCount(rows)).toBe(2)
    expect(mobileChatSessionCount([])).toBe(0)
  })
})
