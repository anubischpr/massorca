import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { PrototypeSystemCard } from '../../../../shared/prototype-design-system-card'
import type { PrototypeCountSetting } from '../../../../shared/prototype-count-setting'
import type { NativeChatPrototypeChoice } from '../../../../shared/prototype-request-decision'
import { useAppStore } from '@/store'
import { resolveNativeChatPrototypeOutgoing } from './native-chat-prototype-request-outgoing'
import { nativeChatPrototypeAsks } from './native-chat-prototype-request-store'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), readCard: vi.fn() }))

vi.mock('./native-chat-prototype-request-send', () => ({
  prepareNativeChatPrototypeText: mocks.prepare,
  readPrototypeSystemCard: mocks.readCard
}))

const SCOPE = 'tab-1:pane'
const KEYWORD = 'Make a mockup of the pricing page'
const COMMAND = '/prototype make a login page'
const CARD: PrototypeSystemCard = {
  kind: 'existing',
  projectKey: 'nexus',
  projectName: 'nexuscare',
  version: 2,
  tokenCount: 24,
  sourceNames: ['main.css'],
  swatches: ['#1d4ed8']
}

function setPrototypeCount(prototypeCount: PrototypeCountSetting): void {
  useAppStore.setState({ settings: { ...getDefaultSettings('/tmp'), prototypeCount } })
}

function resolve(text: string, choice?: NativeChatPrototypeChoice) {
  return resolveNativeChatPrototypeOutgoing({
    text,
    agent: 'codex',
    draftScopeKey: SCOPE,
    attachments: [],
    sentFrom: { text, images: [] },
    sessionId: 'chat-1',
    worktreeId: 'wt-1',
    runtimeEnvironmentId: null,
    ...(choice !== undefined ? { choice } : {})
  })
}

describe('resolveNativeChatPrototypeOutgoing design system card', () => {
  beforeEach(() => {
    setPrototypeCount({ mode: 'ask', count: 2 })
  })

  afterEach(() => {
    nativeChatPrototypeAsks.take(SCOPE)
    vi.clearAllMocks()
  })

  it('holds a counted request behind the design system card when the chat has a system', async () => {
    mocks.readCard.mockResolvedValue(CARD)

    await expect(resolve(KEYWORD, { count: 2 })).resolves.toEqual({ kind: 'ask' })

    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(nativeChatPrototypeAsks.read(SCOPE)).toMatchObject({
      text: KEYWORD,
      designSystem: { count: 2, card: CARD }
    })
  })

  it('sends with the mode the card was answered with, without reading the system again', async () => {
    mocks.prepare.mockResolvedValue('sent with the instruction')

    await expect(resolve(KEYWORD, { count: 2, designSystem: 'use' })).resolves.toEqual({
      kind: 'send',
      text: 'sent with the instruction'
    })

    expect(mocks.readCard).not.toHaveBeenCalled()
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'chat-1', count: 2, designSystem: 'use' })
    )
  })

  it('sends with no mode when the chat’s system cannot be read', async () => {
    mocks.readCard.mockResolvedValue(null)
    mocks.prepare.mockResolvedValue('sent as before')

    await expect(resolve(KEYWORD, { count: 2 })).resolves.toEqual({
      kind: 'send',
      text: 'sent as before'
    })

    expect(mocks.prepare.mock.calls[0]?.[0]).not.toHaveProperty('designSystem')
  })

  it('shows the card for a command too, when the setting decides the count', async () => {
    setPrototypeCount({ mode: 'always', count: 3 })
    mocks.readCard.mockResolvedValue(CARD)

    await expect(resolve(COMMAND)).resolves.toEqual({ kind: 'ask' })

    expect(nativeChatPrototypeAsks.read(SCOPE)?.designSystem).toEqual({ count: 3, card: CARD })
  })

  it('reads no system for text sent as typed, and shows no card for "Not a prototype"', () => {
    expect(resolve(KEYWORD, 'as-typed')).toEqual({ kind: 'send', text: KEYWORD })
    expect(resolve('just say hello')).toEqual({ kind: 'send', text: 'just say hello' })
    expect(mocks.readCard).not.toHaveBeenCalled()
    expect(nativeChatPrototypeAsks.read(SCOPE)).toBeUndefined()
  })
})
