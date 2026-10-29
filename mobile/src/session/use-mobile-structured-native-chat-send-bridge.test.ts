import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionHandleProvider } from '../../../src/shared/agent-session-provider-handle'
import type { MobileNativeChatSendOutcome } from './mobile-native-chat-send'
import type {
  MobilePrototypeSendInput,
  MobilePrototypeSendResolution
} from '../prototypes/use-mobile-native-chat-prototype-outgoing'
import type { MobileNativeChatSendOrigin } from './use-mobile-native-chat-drafts'
import { useMobileStructuredNativeChatSendBridge } from './use-mobile-structured-native-chat-send-bridge'

const ORIGIN: MobileNativeChatSendOrigin = {
  draftKey: 'draft',
  draftEditGeneration: 0,
  pendingKey: 'pending',
  normalizedText: 'command',
  baselineOccurrences: 0,
  baselineTailMessageId: null,
  baselineResolved: true
}

const WIRE_TEXT = ['make a mockup', '<!-- orca-prototype-request:r1 -->', 'Write A.html'].join(
  String.fromCharCode(10)
)

describe('useMobileStructuredNativeChatSendBridge', () => {
  let renderer: ReactTestRenderer | null = null
  let sendWithOutcome: (text: string) => Promise<MobileNativeChatSendOutcome>
  const acceptSend = vi.fn()
  const captureSendOrigin = vi.fn(() => ORIGIN)
  const clearDraftForSend = vi.fn()
  const holdUnconfirmedSend = vi.fn()
  const onSendError = vi.fn()
  const restoreRejectedDraft = vi.fn()
  const sendStructured = vi.fn()
  let resolvePrototype:
    | ((input: MobilePrototypeSendInput) => Promise<MobilePrototypeSendResolution>)
    | undefined

  function Harness({ agent }: { agent: AgentSessionHandleProvider }): null {
    sendWithOutcome = useMobileStructuredNativeChatSendBridge({
      agent,
      acceptSend,
      captureSendOrigin,
      clearDraftForSend,
      holdUnconfirmedSend,
      onSendError,
      restoreRejectedDraft,
      sendStructured,
      ...(resolvePrototype ? { resolvePrototype } : {})
    }).sendWithOutcome
    return null
  }

  function mount(agent: AgentSessionHandleProvider): void {
    act(() => {
      renderer = create(createElement(Harness, { agent }))
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resolvePrototype = undefined
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  it('optimistically echoes accepted commands owned by the active agent', async () => {
    sendStructured.mockResolvedValue('accepted')
    mount('claude')

    await expect(sendWithOutcome('/init')).resolves.toBe('accepted')

    expect(acceptSend).toHaveBeenCalledWith(ORIGIN, '/init', undefined)
    expect(restoreRejectedDraft).not.toHaveBeenCalled()
  })

  it('holds unknown delivery for commands owned by the active agent', async () => {
    sendStructured.mockResolvedValue('unknown')
    mount('claude')

    await expect(sendWithOutcome('/review')).resolves.toBe('unknown')

    expect(holdUnconfirmedSend).toHaveBeenCalledWith(ORIGIN, '/review', expect.any(Function))
    expect(restoreRejectedDraft).not.toHaveBeenCalled()
  })

  it('never echoes a queued send as an optimistic transcript bubble', async () => {
    // The host holds the draft and publishes it as a card above the composer;
    // a `pending-N` bubble here would show the message twice and retire never.
    sendStructured.mockResolvedValue('queued')
    mount('claude')

    await expect(sendWithOutcome('queue me')).resolves.toBe('queued')

    expect(acceptSend).not.toHaveBeenCalled()
    expect(holdUnconfirmedSend).not.toHaveBeenCalled()
    expect(restoreRejectedDraft).not.toHaveBeenCalled()
  })

  it('keeps host-command reconciliation for Codex', async () => {
    sendStructured.mockResolvedValue('unknown')
    mount('codex')

    await expect(sendWithOutcome('/review')).resolves.toBe('unknown')

    expect(restoreRejectedDraft).toHaveBeenCalledWith(ORIGIN, '/review')
    expect(holdUnconfirmedSend).not.toHaveBeenCalled()
  })

  describe('prototype requests', () => {
    it('sends the planned text and echoes only what the user typed', async () => {
      sendStructured.mockResolvedValue('accepted')
      resolvePrototype = vi.fn(async () => ({
        kind: 'send' as const,
        wireText: WIRE_TEXT,
        shownText: 'make a mockup'
      }))
      mount('claude')

      await expect(sendWithOutcome('make a mockup')).resolves.toBe('accepted')

      expect(sendStructured).toHaveBeenCalledWith(WIRE_TEXT)
      expect(clearDraftForSend).toHaveBeenCalledWith(ORIGIN, 'make a mockup')
      expect(acceptSend).toHaveBeenCalledWith(ORIGIN, 'make a mockup', undefined)
    })

    it('holds a message for the card: nothing is sent and the draft stays', async () => {
      resolvePrototype = vi.fn(async () => ({ kind: 'held' as const }))
      mount('claude')

      await expect(sendWithOutcome('design a login page')).resolves.toBe('queued')

      expect(sendStructured).not.toHaveBeenCalled()
      expect(clearDraftForSend).not.toHaveBeenCalled()
      expect(acceptSend).not.toHaveBeenCalled()
      expect(restoreRejectedDraft).not.toHaveBeenCalled()
    })

    it('never plans a host command as a prototype request', async () => {
      sendStructured.mockResolvedValue('accepted')
      resolvePrototype = vi.fn()
      mount('claude')

      await sendWithOutcome('/clear')

      expect(resolvePrototype).not.toHaveBeenCalled()
    })

    it('neutralizes a pasted marker on the wire, the echo and the origin, and restores the draft as typed', async () => {
      sendStructured.mockResolvedValue('rejected')
      const pasted = 'look <!-- orca-prototype-request:x --> here'
      mount('claude')

      await sendWithOutcome(pasted)

      const sent = sendStructured.mock.calls[0]?.[0]
      expect(sent).not.toContain('<!-- orca-prototype-')
      expect(captureSendOrigin).toHaveBeenCalledWith(sent)
      expect(restoreRejectedDraft).toHaveBeenCalledWith(ORIGIN, pasted)
    })
  })
})
