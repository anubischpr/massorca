import { describe, expect, it } from 'vitest'
import { classifyAgentSessionFunctions } from './agent-session-provider-functions'
import type { AgentSessionCommandsResult } from './agent-session-wire'

describe('provider function classification', () => {
  it('does not invent a native registry or classify an omitted old-host catalog', () => {
    const oldHost: AgentSessionCommandsResult = { commands: [] }
    expect(oldHost.functions).toBeUndefined()
    expect(
      classifyAgentSessionFunctions({ commands: undefined, source: 'provider-session' })
    ).toBeUndefined()
    expect(classifyAgentSessionFunctions({ commands: [], source: 'provider-session' })).toEqual([])
  })

  it('preserves supplied common handlers ahead of duplicate provider commands', () => {
    const functions = classifyAgentSessionFunctions({
      commands: [
        { name: 'goal', kind: 'command' },
        { name: 'check', kind: 'command' }
      ],
      commonCommands: [{ name: 'goal', kind: 'command', description: 'Host goal' }],
      source: 'provider-session'
    })
    expect(functions).toEqual([
      {
        name: 'goal',
        description: 'Host goal',
        provenance: 'orca',
        availability: 'available',
        execution: { kind: 'host-operation', operation: 'goal' }
      },
      {
        name: 'check',
        provenance: 'provider-session',
        availability: 'available',
        execution: { kind: 'provider-prompt' }
      }
    ])
  })

  it('does not infer permission operations from an arbitrary common-command name', () => {
    expect(
      classifyAgentSessionFunctions({
        commands: [],
        commonCommands: [{ name: 'permissions', kind: 'command' }],
        source: 'provider-session'
      })
    ).toEqual([])
  })

  it.each(['provider-files', 'provider-initialization'] as const)(
    'keeps %s membership unverified',
    (source) => {
      expect(
        classifyAgentSessionFunctions({ commands: [{ name: 'deploy', kind: 'command' }], source })
      ).toMatchObject([
        {
          name: 'deploy',
          provenance: source,
          availability: 'unverified',
          execution: { kind: 'provider-prompt' }
        }
      ])
    }
  )

  it('keeps skills out of functions and unclassified provider names unverified', () => {
    expect(
      classifyAgentSessionFunctions({
        commands: [
          { name: 'skill', kind: 'skill' },
          { name: 'unknown', kind: 'command', kindUnspecified: true }
        ],
        source: 'provider-session'
      })
    ).toMatchObject([{ name: 'unknown', availability: 'unverified' }])
  })

  it('puts terminal-only names on a non-executable route even if the provider lists both', () => {
    const commands = [{ name: 'doctor', kind: 'command' as const }]
    const functions = classifyAgentSessionFunctions({
      commands,
      terminalCommands: [{ name: 'doctor', description: 'CLI screen' }],
      source: 'provider-session'
    })
    expect(functions).toEqual([
      {
        name: 'doctor',
        description: 'CLI screen',
        provenance: 'provider-session',
        availability: 'terminal-only',
        execution: { kind: 'terminal' }
      }
    ])
    expect(commands).toEqual([{ name: 'doctor', kind: 'command' }])
  })
})
