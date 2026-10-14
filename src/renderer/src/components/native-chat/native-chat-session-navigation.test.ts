import { describe, expect, it, vi } from 'vitest'
import { dispatchNativeChatStructuredComposerText } from './native-chat-structured-composer-dispatch'
import {
  isNativeChatSessionNavigation,
  nativeChatStructuredCatalog,
  withNativeChatSessionCommands
} from './native-chat-session-navigation'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'

const state = vi.hoisted(() => ({ setRightSidebarTab: vi.fn(), setRightSidebarOpen: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))

describe('client session navigation', () => {
  it('keeps reported extension capabilities and exposes omitted Pi built-ins as terminal-only', () => {
    const catalog = nativeChatStructuredCatalog('pi', {
      sessionFunctions: [
        {
          name: 'check',
          provenance: 'provider-session',
          availability: 'available',
          execution: { kind: 'provider-prompt' }
        }
      ]
    })
    expect(catalog.find((entry) => entry.name === 'check')?.providerFunction?.availability).toBe(
      'available'
    )
    expect(catalog.find((entry) => entry.name === 'tree')?.providerFunction).toMatchObject({
      provenance: 'orca',
      availability: 'terminal-only',
      execution: { kind: 'terminal' }
    })
    expect(catalog.filter((entry) => entry.name === 'resume')).toHaveLength(1)
    expect(
      nativeChatStructuredCatalog('codex', {}).find((entry) => entry.name === 'goal')
        ?.providerFunction
    ).toBeUndefined()
  })
  it('keeps window actions when a provider reports an empty or conflicting registry', () => {
    expect(withNativeChatSessionCommands([]).map((x) => x.name)).toEqual(['resume', 'session'])
    expect(
      withNativeChatSessionCommands([
        { name: 'resume', description: 'Provider terminal picker' },
        { name: 'extension' }
      ])
    ).toEqual(
      expect.arrayContaining([
        { name: 'extension' },
        expect.objectContaining({
          name: 'resume',
          description: expect.stringContaining('Sessions panel')
        })
      ])
    )
    expect(
      withNativeChatSessionCommands([{ name: 'resume' }]).filter((x) => x.name === 'resume')
    ).toHaveLength(1)
  })

  it.each(['/resume', '/session', ' /RESUME '])(
    'opens the existing Sessions panel for %s without sending or stopping a provider',
    async (text) => {
      const dispatchCommand = vi.fn(),
        send = vi.fn()
      const transport = {
        dispatchCommand,
        send
      } as unknown as NativeChatStructuredComposerTransport
      expect(await dispatchNativeChatStructuredComposerText(transport, text)).toEqual({
        accepted: true,
        error: null,
        revealsTranscript: false
      })
      expect(state.setRightSidebarTab).toHaveBeenCalledWith('vault')
      expect(state.setRightSidebarOpen).toHaveBeenCalledWith(true)
      expect(dispatchCommand).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
    }
  )

  it('leaves arguments and unrelated commands to their existing dispatcher', () => {
    expect(isNativeChatSessionNavigation('/resume another-session')).toBe(false)
    expect(isNativeChatSessionNavigation('/session-info')).toBe(false)
  })
})
