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

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TasksHomeApprovals } = await import('./TasksHomeApprovals')
const { TASKS_HOME_CREATE_MODES } = await import('./tasks-home-create-modes')

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
})

describe('Tasks home create modes', () => {
  it('has only WorkSpaces until Bot Team ships, so no mode switch is rendered', () => {
    expect(TASKS_HOME_CREATE_MODES).toEqual(['workspaces'])
  })
})
