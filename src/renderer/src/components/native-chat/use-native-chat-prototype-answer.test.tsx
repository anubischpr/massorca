// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentType } from '../../../../shared/agent-status-types'
import { getDefaultSettings } from '../../../../shared/constants'
import type { PrototypeCountSetting } from '../../../../shared/prototype-count-setting'
import { useAppStore } from '@/store'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'
import { nativeChatPrototypeAsks } from './native-chat-prototype-request-store'
import { useNativeChatHeldQueueComposerSend } from './use-native-chat-held-queue-composer-send'
import { useNativeChatPrototypeAskCard } from './use-native-chat-prototype-ask-card'
import {
  useNativeChatStructuredComposerSend,
  type UseNativeChatStructuredComposerSendArgs
} from './use-native-chat-structured-composer-send'

const mocks = vi.hoisted(() => {
  class OutdatedError extends Error {}
  return { createRequest: vi.fn(), OutdatedError }
})

vi.mock('@/runtime/runtime-prototype-client', () => ({
  PrototypeHostOutdatedError: mocks.OutdatedError,
  createPrototypeRequestOnHost: mocks.createRequest
}))
vi.mock('@/lib/native-chat-telemetry', () => ({ emitNativeChatMessageSent: vi.fn() }))
vi.mock('@/lib/worker-terminal-takeover-report', () => ({
  reportStructuredSessionUserInput: vi.fn()
}))

const SCOPE = 'tab-1:pane'
const REQUEST_ID = '20261028-201500-k3f9q2'
const FOLDER = '/work/visuals/prototypes/20261028-201500-k3f9q2'
const COMMAND = '/prototype make a login page'
const KEYWORD = 'Make a mockup of the pricing page'

function setSetting(prototypeCount: PrototypeCountSetting): void {
  useAppStore.setState({ settings: { ...getDefaultSettings('/tmp'), prototypeCount } })
}

function makeArgs(agent: AgentType) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a test double with only the transport members the send path reads.
  const transport = {
    send: vi.fn(() => true),
    dispatchCommand: vi.fn(async () => ({ handled: false, accepted: false, error: null })),
    optionSnapshot: [],
    onError: vi.fn(),
    runtime: 'local',
    sessionId: 'session-prototype',
    runtimeEnvironmentId: null,
    worktreeId: 'wt-1'
  } as unknown as NativeChatStructuredComposerTransport
  const args: UseNativeChatStructuredComposerSendArgs = {
    agent,
    draftScopeKey: SCOPE,
    imageAttachments: [],
    structuredTransport: transport,
    isComposing: () => false,
    clearSkillOrigin: vi.fn(),
    setDraft: vi.fn(),
    setCaret: vi.fn()
  }
  return { args, transport }
}

function CardHarness({ args }: { args: UseNativeChatStructuredComposerSendArgs }) {
  const send = useNativeChatStructuredComposerSend(args)
  return <>{useNativeChatPrototypeAskCard({ draftScopeKey: args.draftScopeKey, send })}</>
}

function HeldHarness({ args }: { args: UseNativeChatStructuredComposerSendArgs }) {
  const { send, fieldProps } = useNativeChatHeldQueueComposerSend(args)
  const confirm = fieldProps.queueSendConfirm
  return (
    <>
      <button type="button" onClick={() => send(KEYWORD)}>
        type
      </button>
      {fieldProps.prototypeAskCard}
      {confirm?.open ? (
        <button type="button" onClick={confirm.sendMessage}>
          send with the cards
        </button>
      ) : null}
    </>
  )
}

describe('answering the "How many prototypes?" card', () => {
  beforeEach(() => {
    mocks.createRequest.mockReset()
    mocks.createRequest.mockResolvedValue({ ok: true, requestId: REQUEST_ID, folderPath: FOLDER })
    nativeChatPrototypeAsks.take(SCOPE)
    setSetting({ mode: 'ask', count: 2 })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('keeps the card and says the answer was not sent while another request is being made', async () => {
    setSetting({ mode: 'always', count: 2 })
    let finish: (value: unknown) => void = () => {}
    mocks.createRequest.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { args, transport } = makeArgs('codex')
    const { result } = renderHook(() => useNativeChatStructuredComposerSend(args))
    const first = result.current(COMMAND)
    await result.current(KEYWORD)
    render(<CardHarness args={args} />)
    await userEvent.click(screen.getByRole('button', { name: '2' }))
    expect(transport.onError).toHaveBeenCalledWith(expect.stringMatching(/not sent/))
    expect(screen.getByRole('group', { name: 'How many prototypes?' })).toBeInTheDocument()
    finish({ ok: true, requestId: REQUEST_ID, folderPath: FOLDER })
    await first
    expect(transport.send).toHaveBeenCalledOnce()
  })

  it('keeps the card, and reports the failure, when the request for the answer fails', async () => {
    mocks.createRequest.mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { args, transport } = makeArgs('codex')
    const { result } = renderHook(() => useNativeChatStructuredComposerSend(args))
    await result.current(KEYWORD)
    render(<CardHarness args={args} />)
    await userEvent.click(screen.getByRole('button', { name: '1' }))
    await vi.waitFor(() => expect(transport.onError).toHaveBeenCalledOnce())
    expect(transport.send).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'How many prototypes?' })).toBeInTheDocument()
  })

  it('waits behind a held queue, as any message does, and sends with the picked count', async () => {
    const { args, transport } = makeArgs('codex')
    const { rerender } = render(<HeldHarness args={args} />)
    await userEvent.click(screen.getByRole('button', { name: 'type' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('group', { name: 'How many prototypes?' })).toBeInTheDocument()
    )
    transport.queueHold = { count: 1, clear: vi.fn(async () => true) }
    rerender(<HeldHarness args={args} />)
    await userEvent.click(screen.getByRole('button', { name: '2' }))
    expect(transport.send).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'send with the cards' }))
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledOnce())
    expect(mocks.createRequest.mock.calls[0]![1]).toMatchObject({
      count: 2,
      originalPrompt: KEYWORD
    })
  })
})
