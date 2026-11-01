/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('../create-chat/use-create-chat-options', () => ({ useCreateChatOptions: () => ({}) }))
vi.mock('../create-chat/create-chat-submit', () => ({ submitCreateChatDraft: vi.fn() }))
vi.mock('../create-chat/CreateChatSession', () => ({
  CreateChatSession: ({
    aboveComposer,
    below
  }: {
    aboveComposer?: ReactNode
    below?: ReactNode
  }) => (
    <div data-testid="workspaces-session">
      {aboveComposer}
      {below}
    </div>
  )
}))
vi.mock('./TasksHomeBotTeamSession', () => ({
  TasksHomeBotTeamSession: ({
    aboveComposer,
    below
  }: {
    aboveComposer?: ReactNode
    below?: ReactNode
  }) => (
    <div data-testid="bot-team-session">
      {aboveComposer}
      {below}
    </div>
  )
}))
vi.mock('./TasksHomeApprovals', () => ({ TasksHomeApprovals: () => <i data-approvals /> }))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { default: TasksHomePage } = await import('./TasksHomePage')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<TasksHomePage />))
  return container
}

const checked = (container: ParentNode): string | undefined =>
  [...container.querySelectorAll('[role="radio"]')].find(
    (radio) => radio.getAttribute('aria-checked') === 'true'
  )?.textContent ?? undefined

beforeEach(() => {
  seedStore(store, { railMode: 'workspaces' })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the Tasks home page', () => {
  it('opens on WorkSpaces with the switch above the composer and the approvals below', () => {
    const container = mount()
    expect(checked(container)).toBe('WorkSpaces')
    expect(container.querySelector('[data-testid="workspaces-session"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="bot-team-session"]')).toBeNull()
    expect(container.querySelector('[data-approvals]')).not.toBeNull()
  })

  it('opens on Bot Team when it is entered from Bot teams mode', () => {
    seedStore(store, { railMode: 'bot-teams' })
    const container = mount()
    expect(checked(container)).toBe('Bot Team')
    expect(container.querySelector('[data-testid="bot-team-session"]')).not.toBeNull()
  })

  it('switches between the two composers, keeping the approvals', () => {
    const container = mount()
    const botTeam = [...container.querySelectorAll<HTMLElement>('[role="radio"]')][1]
    act(() => botTeam.click())
    expect(container.querySelector('[data-testid="bot-team-session"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="workspaces-session"]')).toBeNull()
    expect(container.querySelector('[data-approvals]')).not.toBeNull()
    const workspaces = [...container.querySelectorAll<HTMLElement>('[role="radio"]')][0]
    act(() => workspaces.click())
    expect(checked(container)).toBe('WorkSpaces')
  })
})
