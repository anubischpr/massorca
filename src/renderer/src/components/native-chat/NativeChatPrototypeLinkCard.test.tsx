// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { NativeChatPrototypeLinkCard } from './NativeChatPrototypeLinkCard'

const mocks = vi.hoisted(() => ({
  sets: new Array<PrototypeListedSet>(),
  setActiveView: vi.fn(),
  selectRequest: vi.fn()
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ setActiveView: mocks.setActiveView }) }
}))
vi.mock('../prototypes/prototype-view-store', () => ({
  usePrototypeViewStore: { getState: () => ({ selectRequest: mocks.selectRequest }) }
}))
vi.mock('../prototypes/use-prototype-set-for-request', () => ({
  usePrototypeSetForRequest: () => mocks.sets[0] ?? null
}))

function listedSet(): PrototypeListedSet {
  return {
    requestId: 'req-1',
    sessionId: 'chat-1',
    agent: 'codex',
    worktreeId: null,
    chatTitle: 'Checkout redesign',
    originalPrompt: 'Make a checkout',
    createdAt: '2026-10-29T10:00:00.000Z',
    count: 2,
    directions: []
  }
}

describe('NativeChatPrototypeLinkCard', () => {
  afterEach(() => {
    cleanup()
    mocks.sets.length = 0
    vi.clearAllMocks()
  })

  it('draws nothing until the request has a listed set', () => {
    const { container } = render(<NativeChatPrototypeLinkCard requestId="req-1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the set and opens it in the Prototypes view', async () => {
    mocks.sets.push(listedSet())
    render(<NativeChatPrototypeLinkCard requestId="req-1" />)
    expect(screen.getByText('Checkout redesign · set of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Open in Prototypes/u }))
    expect(mocks.selectRequest).toHaveBeenCalledExactlyOnceWith('req-1')
    expect(mocks.setActiveView).toHaveBeenCalledExactlyOnceWith('prototypes')
  })
})
