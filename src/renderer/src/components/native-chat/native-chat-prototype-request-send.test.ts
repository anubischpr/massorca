import type * as PrototypeClient from '@/runtime/runtime-prototype-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrototypeHostOutdatedError } from '@/runtime/runtime-prototype-client'
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../../../shared/rpc-contract/prototype-params'
import { prepareNativeChatPrototypeText } from './native-chat-prototype-request-send'

const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@/runtime/runtime-prototype-client', async (importOriginal) => ({
  ...(await importOriginal<typeof PrototypeClient>()),
  createPrototypeRequestOnHost: mocks.create
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
