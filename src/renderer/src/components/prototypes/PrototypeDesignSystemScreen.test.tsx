// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeListedDesignSystem } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeDesignSystemScreen } from './PrototypeDesignSystemScreen'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? '')),
  getIntlLocale: () => 'en-GB'
}))

const mocks = vi.hoisted(() => ({
  read: vi.fn()
}))
vi.mock('../../runtime/runtime-prototype-client', () => ({
  readDesignSystemOnHost: mocks.read
}))
vi.mock('./prototype-host-targets', () => ({
  prototypeTargetForSession: () => ({ kind: 'local' })
}))

const UNREADABLE = "Couldn't open this design system"

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: 'landing',
  projectName: 'landing-site',
  status: 'detected',
  version: 1,
  tokenCount: 1,
  swatches: []
}

beforeEach(() => {
  mocks.read.mockReset()
})

afterEach(cleanup)

describe('PrototypeDesignSystemScreen', () => {
  it('reads the system through the newest request’s chat when the project has no set', async () => {
    mocks.read.mockResolvedValue({ ok: false, error: 'not_found' })
    const system = {
      ...SYSTEM,
      newestRequest: { requestId: 'r-newest', sessionId: 'newest-chat', agent: 'claude' as const }
    }
    render(<PrototypeDesignSystemScreen system={system} sets={[]} sendText={vi.fn()} />)
    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument()
    expect(mocks.read).toHaveBeenCalledWith({ kind: 'local' }, { sessionId: 'newest-chat' })
  })

  it('opens the system with its title when it is read through the newest request’s chat', async () => {
    mocks.read.mockResolvedValue({
      ok: true,
      projectKey: 'landing',
      projectName: 'landing-site',
      fileNames: ['design/system/tokens.json'],
      tokensJson: JSON.stringify({
        color: { primary: { $value: '#2563eb' } },
        $extensions: { massorca: { version: 1, status: 'detected' } }
      })
    })
    const system = {
      ...SYSTEM,
      newestRequest: { requestId: 'r-newest', sessionId: 'newest-chat', agent: 'claude' as const }
    }
    const { container } = render(
      <PrototypeDesignSystemScreen system={system} sets={[]} sendText={vi.fn()} />
    )
    expect(await screen.findByText('Design system · landing-site')).toBeInTheDocument()
    expect(screen.queryByText(UNREADABLE)).not.toBeInTheDocument()
    expect(container.querySelector('section')).toHaveClass('bg-sidebar')
    expect(container.querySelector('aside')).toHaveClass('bg-sidebar')
  })

  it('shows a short message, not an empty pane, when the project names no chat at all', async () => {
    const { container } = render(
      <PrototypeDesignSystemScreen system={SYSTEM} sets={[]} sendText={vi.fn()} />
    )
    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument()
    expect(mocks.read).not.toHaveBeenCalled()
    expect(container.firstElementChild).toHaveClass('bg-sidebar')
  })

  it('shows the same message when the host cannot read the system through its chat', async () => {
    mocks.read.mockResolvedValue({ ok: false, error: 'not_found' })
    const system = {
      ...SYSTEM,
      newestRequest: { requestId: 'r-newest', sessionId: 'newest-chat', agent: 'claude' as const }
    }
    render(<PrototypeDesignSystemScreen system={system} sets={[]} sendText={vi.fn()} />)
    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument()
  })
})
