/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../../store', () => ({ useAppStore: store }))

const { MainSessionEmptyState } = await import('./MainSessionEmptyState')

const WT = 'repo::/work/a'
const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<MainSessionEmptyState worktreeId={WT} />))
  return container
}

beforeEach(() => {
  seedStore(store, {
    unifiedTabsByWorktree: { [WT]: [] },
    groupsByWorktree: { [WT]: [] },
    createChatResetNonce: 0,
    activeView: 'terminal'
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('MainSessionEmptyState', () => {
  it('offers the sidebar Create entry when the workspace has no session', () => {
    const button = [...mount().querySelectorAll('button')].find((b) => b.textContent === 'Create')
    expect(button).toBeDefined()
    act(() => button?.click())
    expect(store.getState().activeView).toBe('create-chat')
  })

  it('offers it when only side panel tabs exist', () => {
    seedStore(store, {
      unifiedTabsByWorktree: {
        [WT]: [makeUnifiedTab({ id: 't', worktreeId: WT, groupId: `side-panel:${WT}` })]
      },
      groupsByWorktree: {
        [WT]: [
          makeTabGroup({
            id: `side-panel:${WT}`,
            worktreeId: WT,
            tabOrder: ['t'],
            activeTabId: 't'
          })
        ]
      }
    })
    expect(mount().querySelector('button')).not.toBeNull()
  })

  it('stays out of the way while a session is showing', () => {
    seedStore(store, {
      unifiedTabsByWorktree: {
        [WT]: [
          makeUnifiedTab({
            id: 'chat',
            worktreeId: WT,
            groupId: 'main',
            contentType: 'agent-session'
          })
        ]
      },
      groupsByWorktree: {
        [WT]: [
          makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' })
        ]
      }
    })
    expect(mount().querySelector('button')).toBeNull()
  })
})
