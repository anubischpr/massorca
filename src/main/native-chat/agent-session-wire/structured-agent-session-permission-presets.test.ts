import { describe, expect, it, vi } from 'vitest'
import {
  agentSessionDeclaredAccess,
  legacyAgentSessionAccessMode,
  AGENT_SESSION_PERMISSION_PRESETS,
  type AgentSessionExplicitAccess
} from '../../../shared/agent-session-access-mode'
import { decodeAgentSessionAgentsResult } from '../../../shared/agent-session-registered-agents'
import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import { ANTIGRAVITY_STRUCTURED_AGENT } from '../../antigravity/structured-agent-definition'
import { CLAUDE_STRUCTURED_AGENT } from '../../claude/claude-structured-agent-definition'
import { CODEX_STRUCTURED_AGENT } from '../../codex/codex-structured-agent-definition'
import { PI_RPC_AGENT } from '../../pi/rpc-agent-definition'
import type { StructuredAgentDefinition } from './structured-agent-definition'
import {
  liveStructuredAgentSessionAccessModes,
  recordStructuredAgentSessionOptionIntent
} from './structured-agent-session-options-read'

const DEFINITIONS: Record<string, StructuredAgentDefinition> = {
  claude: CLAUDE_STRUCTURED_AGENT,
  codex: CODEX_STRUCTURED_AGENT,
  antigravity: ANTIGRAVITY_STRUCTURED_AGENT,
  pi: PI_RPC_AGENT
}
const agents = { definition: (agent: string) => DEFINITIONS[agent] }

function recordFor(provider: string, options: Record<string, string> = {}): AgentSessionRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the options code reads only the provider and options.
  return { provider, options } as unknown as AgentSessionRecord
}

async function pick(provider: string, value: string, options: Record<string, string> = {}) {
  const record = recordFor(provider, options)
  const persistOptions = vi.fn(async (next: Record<string, string>) => {
    record.options = next
  })
  const outcome = await recordStructuredAgentSessionOptionIntent(
    { store: { getRecord: () => record }, agents },
    { sessionId: 's', persistOptions, publish: vi.fn() },
    { key: 'accessMode', value }
  )
  return { outcome, persistOptions }
}

describe('permission presets each agent declares', () => {
  it.each([
    ['claude', undefined, ['default', 'full-access'], ['auto', 'accept-edits', 'plan']],
    ['codex', undefined, ['default', 'full-access'], ['auto', 'read-only']],
    ['antigravity', undefined, ['default', 'full-access'], ['auto', 'accept-edits', 'plan']],
    ['pi', undefined, ['full-access'], []],
    ['pi', 'pi', ['full-access'], []],
    ['pi', 'gentle-shell', ['default', 'full-access'], ['auto']]
  ])('declares %s (%s) modes %j and presets %j', (agent, runtime, modes, presets) => {
    const declared = agentSessionDeclaredAccess(DEFINITIONS[agent]?.capabilities, runtime)
    expect(declared?.modes).toEqual(modes)
    expect(declared?.presets).toEqual(presets)
  })

  it('declares only presets the shared vocabulary knows', () => {
    for (const definition of Object.values(DEFINITIONS)) {
      const { supportedPermissionPresets = [], runtimeAccess = {} } = definition.capabilities
      const all = [
        ...supportedPermissionPresets,
        ...Object.values(runtimeAccess).flatMap((entry) => entry.presets ?? [])
      ]
      for (const preset of all) {
        expect(AGENT_SESSION_PERMISSION_PRESETS).toContain(preset)
      }
    }
  })
})

describe('the host accepts only presets the agent declares', () => {
  it.each([
    ['claude', ['auto', 'accept-edits', 'plan', 'default', 'full-access'], ['read-only']],
    ['codex', ['auto', 'read-only', 'default', 'full-access'], ['plan', 'accept-edits']],
    ['antigravity', ['auto', 'accept-edits', 'plan', 'default'], ['read-only']],
    ['pi', ['full-access'], ['auto', 'default', 'plan', 'read-only', 'accept-edits']]
  ])('%s takes %j and refuses %j', async (provider, accepted, refused) => {
    for (const value of accepted) {
      const { outcome } = await pick(provider, value)
      expect(outcome, `${provider} ${value}`).toMatchObject({ ok: true })
    }
    for (const value of refused) {
      const { outcome, persistOptions } = await pick(provider, value)
      expect(outcome, `${provider} ${value}`).toMatchObject({ ok: false })
      expect(persistOptions).not.toHaveBeenCalled()
    }
  })

  it('declares Gentle Shell Ask, Auto and Full access, and nothing for stock Pi', async () => {
    for (const value of ['default', 'auto', 'full-access']) {
      expect((await pick('pi', value, { piRuntime: 'gentle-shell' })).outcome).toMatchObject({
        ok: true
      })
    }
    for (const value of ['plan', 'read-only', 'accept-edits']) {
      expect((await pick('pi', value, { piRuntime: 'gentle-shell' })).outcome).toMatchObject({
        ok: false
      })
    }
    expect((await pick('pi', 'auto', { piRuntime: 'pi' })).outcome).toMatchObject({ ok: false })
  })

  it('still takes the two legacy values from a client that predates presets', async () => {
    for (const value of ['default', 'full-access', 'inherit']) {
      expect((await pick('claude', value)).outcome).toMatchObject({ ok: true })
    }
  })
})

describe('the legacy value a peer without presets is told', () => {
  it.each([
    ['default', 'default'],
    ['auto', 'default'],
    ['accept-edits', 'default'],
    ['plan', 'default'],
    ['read-only', 'default'],
    ['full-access', 'full-access']
  ] as const)('maps %s to %s', (mode, legacy) => {
    expect(legacyAgentSessionAccessMode(mode)).toBe(legacy)
  })

  it('never widens any explicit mode to full access', () => {
    const explicit: AgentSessionExplicitAccess[] = ['default', ...AGENT_SESSION_PERMISSION_PRESETS]
    for (const mode of explicit) {
      expect(legacyAgentSessionAccessMode(mode)).not.toBe('full-access')
    }
  })
})

describe('which modes a running child may switch to', () => {
  const live = (provider: string, adapterModes: AgentSessionExplicitAccess[], options = {}) =>
    liveStructuredAgentSessionAccessModes(
      {
        store: { getRecord: () => recordFor(provider, options) },
        agents,
        adapter: { liveAccessModes: () => adapterModes }
      },
      's'
    )

  it('is what the adapter can apply within what the agent declares', () => {
    expect(live('claude', ['default', 'auto', 'accept-edits', 'plan'])).toEqual([
      'default',
      'auto',
      'accept-edits',
      'plan'
    ])
    expect(live('codex', ['plan'])).toEqual([])
    expect(live('pi', ['default', 'auto', 'full-access'])).toEqual(['full-access'])
    expect(live('pi', ['default', 'auto', 'full-access'], { piRuntime: 'gentle-shell' })).toEqual([
      'default',
      'auto',
      'full-access'
    ])
  })

  it('is empty when the adapter cannot switch a running child', () => {
    expect(
      liveStructuredAgentSessionAccessModes(
        { store: { getRecord: () => recordFor('codex') }, agents, adapter: {} },
        's'
      )
    ).toEqual([])
  })
})

describe('a host that predates presets', () => {
  it('declares no presets, so a client offers only the two legacy modes', () => {
    const rows = decodeAgentSessionAgentsResult({
      agents: [
        { agent: 'claude', capabilities: { supportedAccessModes: ['default', 'full-access'] } }
      ]
    })
    const declared = agentSessionDeclaredAccess(rows?.[0]?.capabilities)
    expect(declared?.presets).toEqual([])
    expect(declared?.explicit).toEqual(['default', 'full-access'])
  })

  it('is read row by row, dropping a preset this build does not know', () => {
    const rows = decodeAgentSessionAgentsResult({
      agents: [
        {
          agent: 'claude',
          capabilities: {
            supportedAccessModes: ['default', 'full-access'],
            supportedPermissionPresets: ['auto', 'future-mode', 'plan']
          }
        },
        {
          agent: 'pi',
          capabilities: {
            supportedAccessModes: ['full-access'],
            runtimeAccess: {
              'gentle-shell': { modes: ['default', 'full-access'], presets: ['auto'] }
            }
          }
        }
      ]
    })
    expect(rows?.[0]?.capabilities.supportedPermissionPresets).toEqual(['auto', 'plan'])
    expect(agentSessionDeclaredAccess(rows?.[1]?.capabilities, 'gentle-shell')?.explicit).toEqual([
      'default',
      'full-access',
      'auto'
    ])
    expect(agentSessionDeclaredAccess(rows?.[1]?.capabilities)?.explicit).toEqual(['full-access'])
  })
})
