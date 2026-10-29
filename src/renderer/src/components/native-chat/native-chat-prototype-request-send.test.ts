import type * as PrototypeClient from '@/runtime/runtime-prototype-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrototypeHostOutdatedError } from '@/runtime/runtime-prototype-client'
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../../../shared/rpc-contract/prototype-params'
import {
  prepareNativeChatPrototypeText,
  readPrototypeSystemCard
} from './native-chat-prototype-request-send'

const mocks = vi.hoisted(() => ({ create: vi.fn(), readSystem: vi.fn() }))

vi.mock('@/runtime/runtime-prototype-client', async (importOriginal) => ({
  ...(await importOriginal<typeof PrototypeClient>()),
  createPrototypeRequestOnHost: mocks.create,
  readDesignSystemOnHost: mocks.readSystem
}))

const input = {
  target: { kind: 'environment', environmentId: 'env-1' } as const,
  sessionId: 'chat-1',
  agent: 'codex' as const,
  text: 'Make a mockup of the pricing page',
  count: 2
}

describe('prepareNativeChatPrototypeText', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('adds the hidden instruction for the folder the runtime made', async () => {
    mocks.create.mockResolvedValue({
      ok: true,
      requestId: '20261029-100000-abc123',
      folderPath: '/srv/prototypes/20261029-100000-abc123'
    })
    const sent = await prepareNativeChatPrototypeText(input)
    expect(sent).toContain('orca-prototype-request:20261029-100000-abc123')
    expect(sent).toContain('/srv/prototypes/20261029-100000-abc123')
    expect(mocks.create).toHaveBeenCalledWith(
      input.target,
      expect.objectContaining({ sessionId: 'chat-1' })
    )
  })

  it.each([
    [
      'an outdated host',
      () => Promise.reject(new PrototypeHostOutdatedError()),
      'does not support'
    ],
    ['a refusal', () => Promise.resolve({ ok: false, error: 'unsupported' }), 'unsupported']
  ])('sends the typed text and logs why for %s', async (_name, answer, reason) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.create.mockImplementation(answer)
    await expect(prepareNativeChatPrototypeText(input)).resolves.toBe(input.text)
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`chat-1.*${reason}|${reason}.*`, 'u'))
    )
    expect(String(warn.mock.calls[0]?.[0])).toContain('chat-1')
    warn.mockRestore()
  })

  it('logs and rethrows an unexpected failure so the send reports it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.create.mockRejectedValue(new Error('boom'))
    await expect(prepareNativeChatPrototypeText(input)).rejects.toThrow('boom')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'))
    warn.mockRestore()
  })

  it('sends the typed text, and logs why, when the reply names no usable folder', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.create.mockResolvedValue({ ok: true, requestId: 'not a valid id', folderPath: '/srv/p' })
    await expect(prepareNativeChatPrototypeText(input)).resolves.toBe(input.text)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no usable request folder'))
    warn.mockRestore()
  })

  it('logs and sends the typed text, without asking the host, when the message is too long', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const long = 'x'.repeat(PROTOTYPE_PROMPT_MAX_LENGTH + 1)
    await expect(prepareNativeChatPrototypeText({ ...input, text: long })).resolves.toBe(long)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('longer than'))
    warn.mockRestore()
  })

  it('gives up on a host that never answers, so the next press is not held behind it', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.create.mockReturnValue(new Promise(() => undefined))
    const settled = expect(prepareNativeChatPrototypeText(input)).rejects.toThrow('within 20000 ms')
    await vi.advanceTimersByTimeAsync(20_000)
    await settled
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('chat-1'))
    warn.mockRestore()
  })
})

const SYSTEM_TOKENS = JSON.stringify({
  color: { primary: { $value: '#1d4ed8' } },
  $extensions: {
    massorca: { version: 2, status: 'detected', agent: 'Codex', sources: [{ path: 'main.css' }] }
  }
})

describe('prepareNativeChatPrototypeText with a design system answer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('makes the request in the answered mode, and its message carries the design system instruction', async () => {
    mocks.create.mockResolvedValue({
      ok: true,
      requestId: '20261029-100000-abc123',
      folderPath: '/srv/prototypes/20261029-100000-abc123'
    })
    const sent = await prepareNativeChatPrototypeText({ ...input, designSystem: 'use' })
    expect(mocks.create).toHaveBeenCalledWith(
      input.target,
      expect.objectContaining({ designSystem: 'use' })
    )
    expect(sent).toContain('design/system/tokens.json')
  })

  it('makes the request with no mode, and no instruction, when the card was not answered', async () => {
    mocks.create.mockResolvedValue({
      ok: true,
      requestId: '20261029-100000-abc123',
      folderPath: '/srv/prototypes/20261029-100000-abc123'
    })
    const sent = await prepareNativeChatPrototypeText(input)
    expect(mocks.create.mock.calls[0]?.[1]).not.toHaveProperty('designSystem')
    expect(sent).not.toContain('design/system/tokens.json')
  })

  it('gives a skipped system no instruction, though the request records the mode', async () => {
    mocks.create.mockResolvedValue({
      ok: true,
      requestId: '20261029-100000-abc123',
      folderPath: '/srv/prototypes/20261029-100000-abc123'
    })
    const sent = await prepareNativeChatPrototypeText({ ...input, designSystem: 'skip' })
    expect(mocks.create).toHaveBeenCalledWith(
      input.target,
      expect.objectContaining({ designSystem: 'skip' })
    )
    expect(sent).not.toContain('design/system/tokens.json')
  })
})

describe('readPrototypeSystemCard', () => {
  const target = { kind: 'environment', environmentId: 'env-1' } as const

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('reads the chat’s design system on the host it lives on, as the card it shows', async () => {
    mocks.readSystem.mockResolvedValue({
      ok: true,
      projectKey: 'nexus',
      projectName: 'nexuscare',
      fileNames: ['design/system/tokens.json'],
      tokensJson: SYSTEM_TOKENS
    })
    await expect(readPrototypeSystemCard(target, 'chat-1')).resolves.toMatchObject({
      kind: 'existing',
      projectName: 'nexuscare',
      version: 2,
      sourceNames: ['main.css']
    })
    expect(mocks.readSystem).toHaveBeenCalledWith(target, { sessionId: 'chat-1' })
  })

  it('gives no card for a chat the host does not know', async () => {
    mocks.readSystem.mockResolvedValue({ ok: false, error: 'not_found' })
    await expect(readPrototypeSystemCard(target, 'chat-1')).resolves.toBeNull()
  })

  it('gives no card, and logs why, when the host is outdated or refuses the read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.readSystem.mockRejectedValue(new PrototypeHostOutdatedError())
    await expect(readPrototypeSystemCard(target, 'chat-1')).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('chat-1'))
    warn.mockRestore()
  })

  it('gives no card when the host does not answer in time, so the send is not held', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.readSystem.mockReturnValue(new Promise(() => undefined))
    const pending = readPrototypeSystemCard(target, 'chat-1')
    await vi.advanceTimersByTimeAsync(3_000)
    await expect(pending).resolves.toBeNull()
    warn.mockRestore()
  })
})
