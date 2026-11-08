import { describe, expect, it, vi } from 'vitest'
import type { PrototypeCountSetting } from '../../../src/shared/prototype-count-setting'
import type { PrototypeAgent } from '../../../src/shared/prototype-request'
import { buildPrototypeRequestMessage } from '../../../src/shared/prototype-request'
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
    useDesignSystem?: boolean
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
      ...(options.choice ? { choice: options.choice } : {}),
      ...(options.useDesignSystem === undefined ? {} : { useDesignSystem: options.useDesignSystem })
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

  it('sends a hand-off to a child session as typed, with no request folder in this chat', async () => {
    const text = 'Crea una sesión hija que diseñe la pantalla de ajustes'
    const { result, createRequest } = plan(text, ALWAYS_3)
    await expect(result).resolves.toEqual({ kind: 'send', wireText: text, shownText: text })
    expect(createRequest).not.toHaveBeenCalled()
  })

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

describe('planMobilePrototypeOutgoing with a reply that names no usable folder', () => {
  it('sends the text as typed, and logs why, when the folder is not the request own', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { result } = plan('/prototype make the pricing page', ALWAYS_3, {
      request: { kind: 'ready', requestId: 'req-1', folderPath: '/chats/c1/prototypes/req-2' }
    })

    await expect(result).resolves.toEqual({
      kind: 'send',
      wireText: '/prototype make the pricing page',
      shownText: '/prototype make the pricing page'
    })
    expect(warn).toHaveBeenCalledWith(
      '[prototypes] request not used: the host named no usable request folder'
    )
    warn.mockRestore()
  })
})

describe('planMobilePrototypeOutgoing design system', () => {
  it('asks the host to use the design system and carries the instruction when the host supports it', async () => {
    const { result, createRequest } = plan('/prototype a login page', ALWAYS_3, {
      useDesignSystem: true
    })
    const planned = await result
    expect(createRequest).toHaveBeenCalledWith({
      text: '/prototype a login page',
      count: 3,
      designSystem: 'use'
    })
    expect(planned.kind === 'send' && planned.wireText).toContain('design/system/tokens.json')
    expect(planned.kind === 'send' && planned.shownText).toBe('/prototype a login page')
  })

  it('names the design system folder the host gave instead of project-relative paths', async () => {
    const { result } = plan('/prototype a login page', ALWAYS_3, {
      useDesignSystem: true,
      request: { ...READY, designSystemFolderPath: '/main/design/system' }
    })
    const planned = await result
    expect(planned.kind === 'send' && planned.wireText).toContain(
      'check whether /main/design/system/tokens.json, /main/design/system/components.html'
    )
    expect(planned.kind === 'send' && planned.shownText).toBe('/prototype a login page')
  })

  it('keeps the usual request byte for byte when the host has not shown support', async () => {
    const { result, createRequest } = plan('/prototype a login page', ALWAYS_3)
    const planned = await result
    expect(createRequest).toHaveBeenCalledWith({ text: '/prototype a login page', count: 3 })
    const expected = buildPrototypeRequestMessage({
      text: '/prototype a login page',
      agent: 'codex',
      count: 3,
      requestId: 'req-1',
      folderPath: '/chats/c1/prototypes/req-1'
    })
    expect(planned).toEqual({
      kind: 'send',
      wireText: expected.sentText,
      shownText: expected.visibleText
    })
    expect(expected.sentText).not.toContain('design/system/tokens.json')
    const off = await plan('/prototype a login page', ALWAYS_3, { useDesignSystem: false }).result
    expect(off).toEqual(planned)
  })
})

describe('planMobilePrototypeOutgoing for a message that names the design system', () => {
  const TEXT = 'Crea el desing system del proyecto oppm'

  it('sends the files and format MassOrca reads behind the text, under the host folder', async () => {
    const readDesignSystemFolder = vi.fn(async () => '/home/user/projects/oppm/design/system')
    const planned = await planMobilePrototypeOutgoing({
      text: TEXT,
      agent: 'claude',
      readSetting: vi.fn(async () => ALWAYS_3),
      createRequest: null,
      readDesignSystemFolder
    })
    expect(planned.kind).toBe('send')
    if (planned.kind !== 'send') {
      return
    }
    expect(planned.shownText).toBe(TEXT)
    expect(splitPrototypeHiddenInstruction(planned.wireText)).toEqual({
      visibleText: TEXT,
      hidden: { kind: 'design-system', action: 'detect' }
    })
    expect(planned.wireText).toContain('/home/user/projects/oppm/design/system/tokens.json')
  })

  it('names project-relative files when the host gives no folder', async () => {
    const planned = await planMobilePrototypeOutgoing({
      text: TEXT,
      agent: 'claude',
      readSetting: vi.fn(async () => ALWAYS_3),
      createRequest: null,
      readDesignSystemFolder: vi.fn(async () => {
        throw new Error('offline')
      })
    })
    expect(planned.kind === 'send' && planned.wireText).toContain(
      'design/system/tokens.json, design/system/components.html and design/system/system.md, relative to the project root.'
    )
  })
})
