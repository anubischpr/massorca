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
  it('offers agy grill-me beside a live session that reports its own functions', () => {
    const common = {
      name: 'clear',
      provenance: 'orca' as const,
      availability: 'available' as const,
      execution: { kind: 'host-operation' as const, operation: 'clear' as const }
    }
    for (const transport of [{ sessionFunctions: [common] }, { sessionCommands: [] }, {}]) {
      const row = nativeChatStructuredCatalog('antigravity', transport).find(
        (entry) => entry.name === 'grill-me'
      )
      expect(row?.description).toBe('Interview me to align on a plan.')
      expect(row?.providerFunction).toBeUndefined()
    }
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
      const transport: NativeChatStructuredComposerTransport = {
        dispatchCommand,
        send,
        optionsSurface: {
          getSnapshot: () => [],
          setOption: vi.fn(),
          invokeAction: vi.fn(),
          subscribe: () => () => {}
        },
        optionSnapshot: [],
        onError: vi.fn(),
        runtime: 'local',
        sessionId: 'navigation-test',
        runtimeEnvironmentId: null
      }
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

  it('offers Gentle Shell commands from the session report and sends them as ordinary Pi prompts', async () => {
    const sessionFunctions = [
      {
        name: 'gentle:jobs',
        description: 'Show background jobs',
        provenance: 'provider-session' as const,
        availability: 'available' as const,
        execution: { kind: 'provider-prompt' as const }
      },
      {
        name: 'gentle:status',
        provenance: 'provider-files' as const,
        availability: 'unverified' as const,
        execution: { kind: 'provider-prompt' as const }
      }
    ]
    const names = nativeChatStructuredCatalog('pi', { sessionFunctions }).map((entry) => entry.name)
    expect(names).toEqual(expect.arrayContaining(['gentle:jobs', 'gentle:status']))
    const dispatchCommand = vi.fn(async () => ({ handled: false, accepted: false, error: null }))
    const send = vi.fn(() => true)
    const transport: NativeChatStructuredComposerTransport = {
      dispatchCommand,
      send,
      sessionFunctions,
      optionsSurface: {
        getSnapshot: () => [],
        setOption: vi.fn(),
        invokeAction: vi.fn(),
        subscribe: () => () => {}
      },
      optionSnapshot: [],
      onError: vi.fn(),
      runtime: 'local',
      sessionId: 'gentle-commands',
      runtimeEnvironmentId: null
    }
    for (const text of ['/gentle:jobs', '/gentle:status now']) {
      expect(await dispatchNativeChatStructuredComposerText(transport, text, [], 'pi')).toEqual({
        accepted: true,
        error: null,
        revealsTranscript: true
      })
      expect(send).toHaveBeenLastCalledWith(text, [])
    }
  })

  it('leaves arguments and unrelated commands to their existing dispatcher', () => {
    expect(isNativeChatSessionNavigation('/resume another-session')).toBe(false)
    expect(isNativeChatSessionNavigation('/session-info')).toBe(false)
  })
})
