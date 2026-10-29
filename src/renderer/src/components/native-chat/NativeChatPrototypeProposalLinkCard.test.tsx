// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeChatPrototypeProposalLinkCard } from './NativeChatPrototypeProposalLinkCard'

const mocks = vi.hoisted(() => ({
  proposals: new Map<string, { requestId: string; projectKey: string }>(),
  open: vi.fn()
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('../prototypes/use-prototype-set-for-request', () => ({
  usePrototypeProposalOfRequest: (requestId: string) => mocks.proposals.get(requestId) ?? null
}))
vi.mock('../prototypes/open-prototype-design-system', () => ({
  openPrototypeDesignSystem: mocks.open
}))

describe('NativeChatPrototypeProposalLinkCard', () => {
  afterEach(() => {
    cleanup()
    mocks.proposals.clear()
    mocks.open.mockClear()
  })

  it('shows nothing for a request that is not a proposal', () => {
    const { container } = render(<NativeChatPrototypeProposalLinkCard requestId="request-1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the design system the request proposed, and opens its Design system view', async () => {
    mocks.proposals.set('request-1', { requestId: 'request-1', projectKey: 'landing' })
    const user = userEvent.setup()
    render(<NativeChatPrototypeProposalLinkCard requestId="request-1" />)
    const card = screen.getByRole('button', { name: /Design system · proposed/u })
    expect(card).toHaveTextContent('Review ›')
    expect(card).toHaveAttribute('data-native-chat-prototype-proposal-link-card', 'true')
    await user.click(card)
    expect(mocks.open).toHaveBeenCalledWith('landing')
  })
})
