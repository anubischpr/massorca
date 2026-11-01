/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
const activate = vi.hoisted(() => vi.fn())
vi.mock('@/components/sidebar/worktree-card-agent-activation', () => ({
  activateAgentTabInWorktree: activate
}))
vi.mock('@/components/AgentStateDot', () => ({ AgentStateDot: () => <span data-dot /> }))
const botRows = vi.hoisted(() => {
  const state: { current: unknown[] } = { current: [] }
  return state
})
vi.mock('./use-bot-team-approval-rows', () => ({
  useBotTeamApprovalRows: () => botRows.current
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TasksHomeApprovals } = await import('./TasksHomeApprovals')

const WT = 'repo::/work/a'
const LEAF = '11111111-1111-4111-8111-111111111111'
const mounted: { container: HTMLDivElement; root: Root }[] = []

function waiting(tab: string, extra: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    paneKey: `${tab}:${LEAF}`,
    state: 'waiting',
    prompt: `Task ${tab}`,
    updatedAt: Date.now(),
    stateStartedAt: Date.now() - 1000,
    stateHistory: [],
    worktreeId: WT,
    agentType: 'claude',
    ...extra
  } as AgentStatusEntry
}

function mount(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<TasksHomeApprovals />))
  return container
}

beforeEach(() => {
  activate.mockReset()
  botRows.current = []
  seedStore(store, { agentStatusByPaneKey: {}, tabsByWorktree: {}, unifiedTabsByWorktree: {} })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('TasksHomeApprovals', () => {
  it('omits the section when nothing waits on the user', () => {
    expect(mount().innerHTML).toBe('')
  })

  it('shows the count and one row per waiting session', () => {
    seedStore(store, {
      agentStatusByPaneKey: {
        [`t1:${LEAF}`]: waiting('t1'),
        [`t2:${LEAF}`]: waiting('t2', { state: 'blocked' })
      }
    })
    const container = mount()
    expect(container.querySelector('h2')?.textContent).toContain('Needs your approval')
    expect(container.querySelector('h2')?.textContent).toContain('2')
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('opens the session of the row it belongs to', () => {
    seedStore(store, { agentStatusByPaneKey: { [`t1:${LEAF}`]: waiting('t1') } })
    const open = [...mount().querySelectorAll('button')].find((b) => b.textContent === 'Open')
    act(() => open?.click())
    expect(activate).toHaveBeenCalledWith(WT, 't1', `t1:${LEAF}`)
  })

  it('labels a session row WorkSpaces', () => {
    seedStore(store, { agentStatusByPaneKey: { [`t1:${LEAF}`]: waiting('t1') } })
    const badge = mount().querySelector(
      'li span[data-slot="badge"], li .badge, li [class*="badge"]'
    )
    expect(mount().querySelector('li')?.textContent).toContain('WorkSpaces')
    expect(badge === null || badge.textContent === 'WorkSpaces').toBe(true)
  })

  it('adds the Bot Team tasks waiting for the person, with the Bot Team badge and a joint count', () => {
    seedStore(store, { agentStatusByPaneKey: { [`t1:${LEAF}`]: waiting('t1') } })
    botRows.current = [
      {
        taskId: 'k1',
        teamId: 'team-1',
        title: 'Publish the flyer',
        teamName: 'Marketing',
        botName: 'Iris'
      }
    ]
    const container = mount()
    expect(container.querySelector('h2')?.textContent).toContain('2')
    const rows = [...container.querySelectorAll('li')]
    expect(rows).toHaveLength(2)
    expect(rows[1].textContent).toContain('Publish the flyer')
    expect(rows[1].textContent).toContain('Marketing · Iris · Waiting for you')
    expect(rows[1].textContent).toContain('Bot Team')
    expect(rows[0].textContent).not.toContain('Bot Team')
  })

  it('shows the section for Bot Team tasks alone, and opens the task thread of the row', () => {
    botRows.current = [
      {
        taskId: 'k1',
        teamId: 'team-1',
        title: 'Publish the flyer',
        teamName: 'Marketing',
        botName: 'Iris'
      }
    ]
    const container = mount()
    expect(container.querySelectorAll('li')).toHaveLength(1)
    const open = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Open')
    act(() => open?.click())
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: 'team-1',
      taskId: 'k1',
      creating: false
    })
    expect(activate).not.toHaveBeenCalled()
  })
})
