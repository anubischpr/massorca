import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeCountSetting } from '../../../src/shared/prototype-count-setting'
import type { MobilePrototypeRequest } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import { mobilePrototypeAsks } from './mobile-prototype-ask-store'
import {
  useMobileNativeChatPrototypeOutgoing,
  type MobilePrototypeSendResolution
} from './use-mobile-native-chat-prototype-outgoing'

const createRequest = vi.fn<(...args: unknown[]) => Promise<MobilePrototypeRequest>>()
const readSetting = vi.fn<() => Promise<PrototypeCountSetting>>()
vi.mock('../session/mobile-prototype-host-rpc', () => ({
  createMobilePrototypeRequest: (...args: unknown[]) => createRequest(...args)
}))
vi.mock('./mobile-prototype-count-setting', () => ({
  readMobilePrototypeCountSetting: () => readSetting()
}))

const SCOPE = 'host\0wt\0tab'
const CLIENT: RpcClient = {
  sendRequest: vi.fn<RpcClient['sendRequest']>(),
  subscribe: () => () => {},
  updateTerminalSubscriptionViewport: () => {},
  getState: () => 'connected',
  getReconnectAttempt: () => 0,
  getLastConnectedAt: () => null,
  onStateChange: () => () => {},
  notifyForeground: () => {},
  close: () => {}
}

describe('useMobileNativeChatPrototypeOutgoing', () => {
  let renderer: ReactTestRenderer | null = null
  let resolve: ReturnType<typeof useMobileNativeChatPrototypeOutgoing>

  function mount(sessionId: string | null = 'session-1'): void {
    function Probe(): null {
      resolve = useMobileNativeChatPrototypeOutgoing({
        client: CLIENT,
        scopeKey: SCOPE,
        sessionId,
        worktreeId: 'wt',
        agent: 'codex',
        piRuntime: undefined
      })
      return null
    }
    act(() => {
      renderer = create(createElement(Probe))
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mobilePrototypeAsks.take(SCOPE)
    readSetting.mockResolvedValue({ mode: 'ask', count: 3 })
    createRequest.mockResolvedValue({ kind: 'ready', requestId: 'req-1', folderPath: '/p/req-1' })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  it('holds a message that asks for prototypes on the card, with what rode along', async () => {
    mount()
    let resolution: MobilePrototypeSendResolution | undefined
    await act(async () => {
      resolution = await resolve({ text: 'Make a mockup of the cart', images: ['file:///a.png'] })
    })
    expect(resolution).toEqual({ kind: 'held' })
    expect(createRequest).not.toHaveBeenCalled()
    expect(mobilePrototypeAsks.read(SCOPE)).toEqual({
      text: 'Make a mockup of the cart',
      images: ['file:///a.png'],
      keyword: true,
      defaultCount: 3,
      agentName: 'Codex'
    })
  })

  it('makes the request folder for the picked count and hands back the hidden instruction', async () => {
    mount()
    let resolution: MobilePrototypeSendResolution | undefined
    await act(async () => {
      resolution = await resolve({ text: 'Make a mockup of the cart', choice: { count: 2 } })
    })
    expect(createRequest).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({
        sessionId: 'session-1',
        agent: 'codex',
        count: 2,
        worktreeId: 'wt'
      })
    )
    expect(resolution?.kind).toBe('send')
    if (resolution?.kind === 'send') {
      expect(resolution.shownText).toBe('Make a mockup of the cart')
      expect(resolution.wireText).toContain('orca-prototype-request:req-1')
    }
    expect(mobilePrototypeAsks.read(SCOPE)).toBeUndefined()
  })

  it('retires a card still waiting when another message is sent', async () => {
    mount()
    await act(async () => {
      await resolve({ text: 'Make a mockup of the cart' })
    })
    expect(mobilePrototypeAsks.read(SCOPE)).toBeDefined()
    await act(async () => {
      await resolve({ text: 'Fix the build' })
    })
    expect(mobilePrototypeAsks.read(SCOPE)).toBeUndefined()
  })

  it('sends a message as typed from a chat with no session to name', async () => {
    mount(null)
    let resolution: MobilePrototypeSendResolution | undefined
    await act(async () => {
      resolution = await resolve({ text: '/prototype a login page', choice: { count: 2 } })
    })
    expect(createRequest).not.toHaveBeenCalled()
    expect(resolution).toEqual({
      kind: 'send',
      wireText: '/prototype a login page',
      shownText: '/prototype a login page'
    })
  })

  it('waits on a second press while the host makes the first folder', async () => {
    let finish: (request: MobilePrototypeRequest) => void = () => undefined
    createRequest.mockReturnValue(new Promise((resolveRequest) => (finish = resolveRequest)))
    mount()
    let first: Promise<MobilePrototypeSendResolution> | undefined
    await act(async () => {
      first = resolve({ text: '/prototype a login page', choice: { count: 2 } })
      await Promise.resolve()
    })
    let second: MobilePrototypeSendResolution | undefined
    await act(async () => {
      second = await resolve({ text: '/prototype a login page', choice: { count: 2 } })
    })
    expect(second).toEqual({ kind: 'held' })
    await act(async () => {
      finish({ kind: 'ready', requestId: 'req-2', folderPath: '/p/req-2' })
      await first
    })
    expect(createRequest).toHaveBeenCalledTimes(1)
  })
})
