// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getIntlLocale } from '@/i18n/i18n'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { NativeChatSessionChecklistSection } from './NativeChatSessionChecklistSection'

const rpc = vi.hoisted(() => ({ call: vi.fn() }))
const sender = vi.hoisted(() => ({ send: vi.fn(() => null) }))
const screenshots = vi.hoisted(() => ({ store: vi.fn() }))
const failures = vi.hoisted(() => {
  class MockRuntimeRpcCallError extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return { MockRuntimeRpcCallError }
})

vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: rpc.call,
  RuntimeRpcCallError: failures.MockRuntimeRpcCallError
}))
vi.mock('@/store', () => ({
  useAppStore: Object.assign(() => undefined, {
    getState: () => ({ worktreesByRepo: {} })
  })
}))
vi.mock('./structured-agent-session-message-sender', () => ({
  sendStructuredAgentSessionMessage: sender.send
}))
vi.mock('./native-chat-checklist-screenshots', () => ({
  nativeChatChecklistAttachmentOwner: () => ({ kind: 'local' }),
  storeNativeChatChecklistScreenshots: screenshots.store
}))

const AT_WRITE = Date.UTC(2026, 10, 2, 13, 52)
const AT_PERSON = Date.UTC(2026, 10, 2, 14, 2)
const CHECKLIST_REPLY =
  '```orca-checklist\ntitle: QA preview\n- [x] Login works\n- [ ] Open the summary\n- [ ] Logout works\n```'

function time(at: number): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: 'numeric', minute: '2-digit' }).format(
    new Date(at)
  )
}

function reply(text: string, observedAt: number): AgentJournalRenderItem {
  return {
    itemId: `reply-${observedAt}`,
    revision: 1,
    sequence: observedAt,
    observedAt,
    body: { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text }] }
  }
}

/** The host's record: the person checked "Open the summary" after the agent's last delivery. */
function personState() {
  return {
    revision: 2,
    deliveredRevision: 1,
    title: null,
    marks: {
      'open the summary': {
        text: 'Open the summary',
        checked: true,
        checkedAt: AT_PERSON,
        revision: 2
      }
    }
  }
}

function renderCard(journalItems: AgentJournalRenderItem[]) {
  return render(
    <TooltipProvider>
      <NativeChatSessionChecklistSection
        target={{ kind: 'local' }}
        sessionId="chat-1"
        journalItems={journalItems}
        agentLabel="Claude"
        worktreeId={null}
      />
    </TooltipProvider>
  )
}

function openCard(): void {
  fireEvent.click(screen.getByRole('button', { name: /Checklist/ }))
}

let previousApi: unknown

beforeEach(() => {
  previousApi = Reflect.get(window, 'api')
  rpc.call.mockReset()
  rpc.call.mockImplementation(async (_target: unknown, method: string) => {
    if (method === 'agentSessionChecklist.read') {
      return { ok: true, state: personState() }
    }
    throw new Error(`unexpected ${method}`)
  })
  sender.send.mockClear()
  screenshots.store.mockReset()
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'api', { configurable: true, value: previousApi })
})

describe('NativeChatSessionChecklistSection', () => {
  it('shows progress, the next unchecked item, and the agent line when collapsed', async () => {
    renderCard([reply(CHECKLIST_REPLY, AT_WRITE)])

    expect(await screen.findByText('2 of 3')).toBeTruthy()
    expect(screen.getByText('Logout works')).toBeTruthy()
    expect(screen.queryByText('Login works')).toBeNull()
  })

  it('names who changed each item and when, with the unseen footer when the agent has not seen a change', async () => {
    renderCard([reply(CHECKLIST_REPLY, AT_WRITE)])
    openCard()

    expect(await screen.findByText(`QA preview · from Claude, ${time(AT_WRITE)}`)).toBeTruthy()
    expect(screen.getByText(`Checked by Claude · ${time(AT_WRITE)}`)).toBeTruthy()
    expect(screen.getByText(`Checked by you · ${time(AT_PERSON)}`)).toBeTruthy()
    expect(
      screen.getByText('1 change the agent has not seen. It goes with your next message.')
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send now' })).toBeTruthy()
  })

  it('writes a check through the host and shows the person as the one who checked it', async () => {
    rpc.call.mockImplementation(
      async (_target: unknown, method: string, params: { text: string }) => {
        if (method === 'agentSessionChecklist.setItem') {
          expect(params.text).toBe('Logout works')
          return { ok: true, state: { ...personState(), revision: 3 } }
        }
        return { ok: true, state: personState() }
      }
    )
    renderCard([reply(CHECKLIST_REPLY, AT_WRITE)])
    openCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Check item' }))

    await waitFor(() =>
      expect(rpc.call).toHaveBeenCalledWith(
        { kind: 'local' },
        'agentSessionChecklist.setItem',
        expect.objectContaining({
          sessionId: 'chat-1',
          title: 'QA preview',
          text: 'Logout works',
          checked: true
        })
      )
    )
  })

  it('keeps the card read-only on a host without the checklist methods', async () => {
    rpc.call.mockRejectedValue(new failures.MockRuntimeRpcCallError('method_not_found'))
    renderCard([reply(CHECKLIST_REPLY, AT_WRITE)])
    openCard()

    expect(await screen.findByText('Update the host to check items here.')).toBeTruthy()
    for (const button of screen.getAllByRole('button', { name: /Check item|Uncheck item/ })) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull()
  })

  it('saves the note and the attached screenshot of an item in one write', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { shell: { pickImage: vi.fn(async () => '/shots/a.png') } }
    })
    screenshots.store.mockResolvedValue({
      screenshots: [{ path: '/host/a.png', name: 'a.png' }],
      notice: null
    })
    rpc.call.mockImplementation(async () => ({ ok: true, state: personState() }))
    renderCard([reply(CHECKLIST_REPLY, AT_WRITE)])
    openCard()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Add note' }))[0]!)
    const note = await screen.findByRole('textbox')
    fireEvent.change(note, { target: { value: 'Falla el login' } })
    const editor = note.closest<HTMLElement>('[data-native-chat-checklist-editor]')
    if (!editor) {
      throw new Error('the note editor is missing')
    }
    fireEvent.click(within(editor).getByRole('button', { name: 'Attach screenshot' }))
    await within(editor).findByText('a.png')
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(rpc.call).toHaveBeenCalledWith(
        { kind: 'local' },
        'agentSessionChecklist.setItem',
        expect.objectContaining({
          text: 'Login works',
          note: 'Falla el login',
          screenshots: [{ path: '/host/a.png', name: 'a.png' }]
        })
      )
    )
  })

  it('sends the update now with the checklist message', async () => {
    renderCard([reply(CHECKLIST_REPLY, AT_WRITE)])
    openCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Send now' }))

    expect(sender.send).toHaveBeenCalledWith({
      sessionId: 'chat-1',
      target: { kind: 'local' },
      text: 'Checklist updated.'
    })
  })

  it('renders nothing when the agent has written no checklist', () => {
    const { container } = renderCard([reply('No list yet', AT_WRITE)])

    expect(container.textContent).toBe('')
  })
})
