// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeListedDesignSystem } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeDesignSystemScreen } from './PrototypeDesignSystemScreen'
import { usePrototypeViewStore } from './prototype-view-store'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? '')),
  getIntlLocale: () => 'en-GB'
}))

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  // The chat composer's attach flow, past its picker and upload: the paths it would attach.
  picked: [] as string[]
}))
vi.mock('../../runtime/runtime-prototype-client', () => ({
  readDesignSystemOnHost: mocks.read
}))
vi.mock('./prototype-host-targets', () => ({
  prototypeTargetForSession: () => ({ kind: 'local' }),
  worktreeIdOfChatSession: () => 'wt-1'
}))
vi.mock('../native-chat/use-native-chat-external-attachments', () => ({
  useNativeChatExternalAttachments: (args: { attachResolvedPaths: (paths: string[]) => void }) => ({
    attachExternalPaths: () => args.attachResolvedPaths(mocks.picked)
  })
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
  mocks.picked = []
  usePrototypeViewStore.setState({ designSystemViews: {} })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { shell: { pickAttachments: () => Promise.resolve([]) } }
  })
})

function readableSystem(): PrototypeListedDesignSystem {
  mocks.read.mockResolvedValue({
    ok: true,
    projectKey: 'landing',
    projectName: 'landing-site',
    fileNames: ['design/system/tokens.json', 'design/system/components.html'],
    tokensJson: JSON.stringify({
      color: { primary: { $value: '#2563eb' } },
      $extensions: { massorca: { version: 1, status: 'detected' } }
    }),
    componentsHtml:
      '<section data-component="Button" data-variants="primary" data-variant-options="primary secondary"><button>Go</button></section>'
  })
  return {
    ...SYSTEM,
    newestRequest: { requestId: 'r-newest', sessionId: 'newest-chat', agent: 'claude' as const }
  }
}

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

  it('attaches an image from Anything else and sends it with the draft to the agent', async () => {
    const sendText = vi.fn().mockResolvedValue(true)
    render(<PrototypeDesignSystemScreen system={readableSystem()} sets={[]} sendText={sendText} />)
    await screen.findByText('Design system · landing-site')
    mocks.picked = ['/shots/brand.png']
    const anythingElse = screen.getByText('Anything else').parentElement
    fireEvent.click(
      within(anythingElse as HTMLElement).getByRole('button', { name: 'Attach file' })
    )
    const list = await screen.findByRole('list', { name: 'Attached images' })
    expect(within(list).getByText('brand.png')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send to Claude' }))
    await waitFor(() => expect(sendText).toHaveBeenCalledTimes(1))
    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'newest-chat' }),
      expect.any(String),
      [{ path: '/shots/brand.png' }]
    )
    // A sent draft lets its images go with it.
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Attached images' })).not.toBeInTheDocument()
    )
  })

  it('attaches an image from a component note into the same draft', async () => {
    render(<PrototypeDesignSystemScreen system={readableSystem()} sets={[]} sendText={vi.fn()} />)
    await screen.findByText('Design system · landing-site')
    mocks.picked = ['/shots/hover.gif']
    const note = screen.getByText('Note — anything Edit can’t do').parentElement
    fireEvent.click(within(note as HTMLElement).getByRole('button', { name: 'Attach file' }))
    const list = await screen.findByRole('list', { name: 'Attached images' })
    expect(within(list).getByText('hover.gif')).toBeInTheDocument()
    fireEvent.click(within(list).getByRole('button', { name: 'Remove hover.gif' }))
    expect(screen.queryByRole('list', { name: 'Attached images' })).not.toBeInTheDocument()
  })

  it('says only images can be attached, and attaches nothing else', async () => {
    render(<PrototypeDesignSystemScreen system={readableSystem()} sets={[]} sendText={vi.fn()} />)
    await screen.findByText('Design system · landing-site')
    mocks.picked = ['/docs/brief.pdf']
    const anythingElse = screen.getByText('Anything else').parentElement
    fireEvent.click(
      within(anythingElse as HTMLElement).getByRole('button', { name: 'Attach file' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Only images can be attached here.')
    expect(screen.queryByRole('list', { name: 'Attached images' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to Claude' })).toBeDisabled()
  })
})
