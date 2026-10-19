import { describe, expect, it } from 'vitest'
import {
  STRUCTURED_AGENT_SESSION_ADOPT_ANTIGRAVITY_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_SURFACE_RUNTIME_CAPABILITIES,
  structuredAgentSessionAdoptsAgent
} from './structured-agent-session-surface-capabilities'
import { RUNTIME_CAPABILITIES } from './protocol-version'

const OLD_HOST = ['agent-session.structured.reveal.v1', 'agent-session.structured.hold.v1']

describe('structuredAgentSessionAdoptsAgent', () => {
  it('keeps Claude and Codex adoptable on every host, old or new', () => {
    expect(structuredAgentSessionAdoptsAgent('claude', OLD_HOST)).toBe(true)
    expect(structuredAgentSessionAdoptsAgent('codex', null)).toBe(true)
  })

  it('withholds Antigravity from a host that does not advertise the adopt capability', () => {
    // An older host, or a client that never learned its capabilities, keeps the terminal path.
    expect(structuredAgentSessionAdoptsAgent('antigravity', OLD_HOST)).toBe(false)
    expect(structuredAgentSessionAdoptsAgent('antigravity', null)).toBe(false)
    expect(structuredAgentSessionAdoptsAgent('antigravity', undefined)).toBe(false)
  })

  it('admits Antigravity only when its capability is advertised', () => {
    expect(
      structuredAgentSessionAdoptsAgent('antigravity', [
        ...OLD_HOST,
        STRUCTURED_AGENT_SESSION_ADOPT_ANTIGRAVITY_RUNTIME_CAPABILITY
      ])
    ).toBe(true)
  })

  it('refuses agents with no adoption lane regardless of capabilities', () => {
    expect(
      structuredAgentSessionAdoptsAgent('grok', [
        STRUCTURED_AGENT_SESSION_ADOPT_ANTIGRAVITY_RUNTIME_CAPABILITY
      ])
    ).toBe(false)
  })

  it('publishes the capability through the host capability list', () => {
    expect(STRUCTURED_AGENT_SESSION_SURFACE_RUNTIME_CAPABILITIES).toContain(
      STRUCTURED_AGENT_SESSION_ADOPT_ANTIGRAVITY_RUNTIME_CAPABILITY
    )
    expect(RUNTIME_CAPABILITIES).toContain(
      STRUCTURED_AGENT_SESSION_ADOPT_ANTIGRAVITY_RUNTIME_CAPABILITY
    )
  })
})
