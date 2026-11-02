/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createTestStore } = await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))

const { useRailModePersistence } = await import('./use-rail-mode-persistence')

const setUi = vi.fn()

function Probe(): null {
  useRailModePersistence()
  return null
}

function mount(): () => void {
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => root.render(<Probe />))
  return () => act(() => root.unmount())
}

beforeEach(() => {
  vi.useFakeTimers()
  setUi.mockReset()
  Object.defineProperty(window, 'api', { configurable: true, value: { ui: { set: setUi } } })
  store.setState({ persistedUIReady: true, railMode: 'workspaces', railWorkspacesHintShown: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRailModePersistence', () => {
  it('writes nothing for the hydrated values', () => {
    const unmount = mount()
    act(() => void vi.advanceTimersByTime(1000))
    expect(setUi).not.toHaveBeenCalled()
    unmount()
  })

  it('saves a mode change with only the two rail fields', () => {
    const unmount = mount()
    act(() => store.setState({ railMode: 'bot-teams' }))
    act(() => void vi.advanceTimersByTime(300))
    expect(setUi).toHaveBeenCalledTimes(1)
    expect(setUi).toHaveBeenCalledWith({ railMode: 'bot-teams', railWorkspacesHintShown: false })
    unmount()
  })

  it('saves the shown flag once the hint was shown', () => {
    const unmount = mount()
    act(() => store.getState().markRailWorkspacesHintShown())
    act(() => void vi.advanceTimersByTime(300))
    expect(setUi).toHaveBeenCalledWith({ railMode: 'workspaces', railWorkspacesHintShown: true })
    unmount()
  })
})
