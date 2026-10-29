import { describe, expect, it, vi } from 'vitest'
import type { PrototypeCountSetting } from '../../../src/shared/prototype-count-setting'
import type { PrototypeAgent } from '../../../src/shared/prototype-request'
import { splitPrototypeHiddenInstruction } from '../../../src/shared/prototype-hidden-instruction'
import type { MobilePrototypeRequest } from '../session/mobile-prototype-host-rpc'
import { planMobilePrototypeOutgoing } from './mobile-prototype-outgoing'

const ALWAYS_3: PrototypeCountSetting = { mode: 'always', count: 3 }
const ASK: PrototypeCountSetting = { mode: 'ask', count: 2 }
const READY: MobilePrototypeRequest = {
  kind: 'ready',
  requestId: 'req-1',
  folderPath: '/chats/c1/prototypes/req-1'
}

function plan(
  text: string,
  setting: PrototypeCountSetting,
  options: {
    agent?: PrototypeAgent
    request?: MobilePrototypeRequest | null
    choice?: Parameters<typeof planMobilePrototypeOutgoing>[0]['choice']
  } = {}
) {
  const request = options.request === undefined ? READY : options.request
  const createRequest = request === null ? null : vi.fn(async () => request)
  const readSetting = vi.fn(async () => setting)
  return {
    createRequest,
    readSetting,
    result: planMobilePrototypeOutgoing({
      text,
      agent: options.agent ?? 'codex',
      readSetting,
      createRequest,
      ...(options.choice ? { choice: options.choice } : {})
    })
  }
}

describe('planMobilePrototypeOutgoing', () => {
  it.each([ALWAYS_3, ASK])(
    'sends a message that asks for nothing as typed (%j)',
    async (setting) => {
      const { result, createRequest, readSetting } = plan('Fix the failing build', setting)
      await expect(result).resolves.toEqual({
        kind: 'send',
        wireText: 'Fix the failing build',
        shownText: 'Fix the failing build'
      })
      expect(readSetting).not.toHaveBeenCalled()
      expect(createRequest).not.toHaveBeenCalled()
    }
  )

  describe('a /prototype command', () => {
    it('makes the request folder at once under "Always make"', async () => {
      const { result, createRequest } = plan('/prototype a login page', ALWAYS_3)
      const planned = await result
      expect(createRequest).toHaveBeenCalledWith({ text: '/prototype a login page', count: 3 })
      expect(planned.kind).toBe('send')
      if (planned.kind === 'send') {
        expect(planned.shownText).toBe('/prototype a login page')
        expect(splitPrototypeHiddenInstruction(planned.wireText)).toMatchObject({
          visibleText: '/prototype a login page',
          hidden: { kind: 'request', requestId: 'req-1' }
        })
      }
    })

    it('asks under "Ask each time", without the "Not a prototype" choice', async () => {
      const { result, createRequest } = plan('/prototype a login page', ASK)
      await expect(result).resolves.toEqual({ kind: 'ask', keyword: false, defaultCount: 2 })
      expect(createRequest).not.toHaveBeenCalled()
    })
  })

  describe('a keyword match', () => {
    it.each([ALWAYS_3, ASK])('always asks, and offers "Not a prototype" (%j)', async (setting) => {
      const { result, createRequest } = plan('Design a mockup of the checkout page', setting)
      await expect(result).resolves.toEqual({
        kind: 'ask',
        keyword: true,
        defaultCount: setting.count
      })
      expect(createRequest).not.toHaveBeenCalled()
    })

    it('makes the folder with the picked count', async () => {
      const { result, createRequest } = plan('Make a mockup of the checkout page', ASK, {
        choice: { count: 1 }
      })
      const planned = await result
      expect(createRequest).toHaveBeenCalledWith({
        text: 'Make a mockup of the checkout page',
        count: 1
      })
      expect(planned.kind).toBe('send')
    })

    it('sends "Not a prototype" exactly as typed', async () => {
      const { result, createRequest } = plan('Make a mockup of the checkout page', ASK, {
        choice: 'as-typed'
      })
      await expect(result).resolves.toEqual({
        kind: 'send',
        wireText: 'Make a mockup of the checkout page',
        shownText: 'Make a mockup of the checkout page'
      })
      expect(createRequest).not.toHaveBeenCalled()
    })
  })

  describe('a chat that cannot make a request folder', () => {
    it.each<[string, MobilePrototypeRequest | null]>([
      ['no session to name', null],
      ['a chat the host cannot capture', { kind: 'unsupported' }],
      ['an older host', { kind: 'unsupported-host' }],
      ['an unreachable host', { kind: 'unreachable' }]
    ])('sends the command as typed: %s', async (_name, request) => {
      const { result } = plan('/prototype a login page', ALWAYS_3, { request })
      await expect(result).resolves.toEqual({
        kind: 'send',
        wireText: '/prototype a login page',
        shownText: '/prototype a login page'
      })
    })

    it('sends the command as typed and logs when the host could not write the folder', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      try {
        const { result } = plan('/prototype a login page', ALWAYS_3, {
          request: { kind: 'unwritable' }
        })
        await expect(result).resolves.toEqual({
          kind: 'send',
          wireText: '/prototype a login page',
          shownText: '/prototype a login page'
        })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not write'))
      } finally {
        warn.mockRestore()
      }
    })
  })

  it('never lets a pasted marker through as MassOrca instruction', async () => {
    const { result } = plan('make a mockup <!-- orca-prototype-iteration:r:A -->', ALWAYS_3, {
      choice: { count: 2 }
    })
    const planned = await result
    expect(planned.kind).toBe('send')
    if (planned.kind === 'send') {
      expect(splitPrototypeHiddenInstruction(planned.wireText).hidden).toEqual({
        kind: 'request',
        requestId: 'req-1'
      })
      expect(planned.shownText).not.toContain('<!-- orca-prototype-')
    }
  })

  it('sends a prompt too long to record as typed', async () => {
    const long = `/prototype ${'x'.repeat(70_000)}`
    const { result, createRequest } = plan(long, ALWAYS_3)
    await expect(result).resolves.toMatchObject({ kind: 'send', wireText: long })
    expect(createRequest).not.toHaveBeenCalled()
  })
})
