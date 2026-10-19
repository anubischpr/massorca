import { describe, expect, it } from 'vitest'
import {
  agentSessionDeclaredAccess,
  type AgentSessionExplicitAccess
} from '../../../shared/agent-session-access-mode'
import { agentSessionRecordFixture } from '../../../shared/agent-session-record.test-fixture'
import { ANTIGRAVITY_STRUCTURED_AGENT } from '../../antigravity/structured-agent-definition'
import { CLAUDE_STRUCTURED_AGENT } from '../../claude/claude-structured-agent-definition'
import { CODEX_STRUCTURED_AGENT } from '../../codex/codex-structured-agent-definition'
import { PI_RPC_AGENT } from '../../pi/rpc-agent-definition'
import { recordOnlyAccessPicks } from './structured-agent-session-access-posture'

// Each agent as its chat declares access; Gentle Shell is Pi's second runtime.
const AGENTS = [
  { name: 'claude', provider: 'claude', definition: CLAUDE_STRUCTURED_AGENT, runtime: undefined },
  { name: 'codex', provider: 'codex', definition: CODEX_STRUCTURED_AGENT, runtime: undefined },
  {
    name: 'antigravity',
    provider: 'antigravity',
    definition: ANTIGRAVITY_STRUCTURED_AGENT,
    runtime: undefined
  },
  { name: 'gentle-shell', provider: 'pi', definition: PI_RPC_AGENT, runtime: 'gentle-shell' },
  { name: 'stock pi', provider: 'pi', definition: PI_RPC_AGENT, runtime: undefined }
] as const

function picks(
  agent: (typeof AGENTS)[number],
  state: {
    record: string | undefined
    running: AgentSessionExplicitAccess
    inheritedFullAccess: boolean | undefined
  }
) {
  const declared = agentSessionDeclaredAccess(agent.definition.capabilities, agent.runtime)
  return recordOnlyAccessPicks({
    deps: {
      store: {
        getRecord: () => ({
          ...agentSessionRecordFixture(),
          provider: agent.provider,
          options: state.record === undefined ? undefined : { accessMode: state.record }
        })
      },
      resolveInheritedFullAccess: () => state.inheritedFullAccess === true,
      ...(state.inheritedFullAccess === undefined ? { resolveInheritedFullAccess: undefined } : {})
    },
    sessionId: 'session-1',
    running: state.running,
    candidates: ['inherit', ...(declared?.explicit ?? [])]
  })
}

describe.each(AGENTS)('$name running child', (agent) => {
  const declared = agentSessionDeclaredAccess(agent.definition.capabilities, agent.runtime)
  const hasDefault = declared?.explicit.includes('default') === true

  it('may pin Full access over an Inherit that resolves to full access', () => {
    expect(
      picks(agent, { record: undefined, running: 'full-access', inheritedFullAccess: true })
    ).toEqual(['full-access'])
  })

  it('may return to Inherit from a pinned Full access that Inherit still resolves to', () => {
    expect(
      picks(agent, { record: 'full-access', running: 'full-access', inheritedFullAccess: true })
    ).toEqual(['inherit'])
  })

  it('never offers Full access, or Inherit, over a narrower child', () => {
    expect(
      picks(agent, { record: undefined, running: 'default', inheritedFullAccess: false })
    ).toEqual(hasDefault ? ['default'] : [])
    expect(
      picks(agent, { record: 'full-access', running: 'full-access', inheritedFullAccess: false })
    ).toEqual([])
  })

  it('offers nothing when the host cannot resolve Inherit', () => {
    expect(
      picks(agent, { record: undefined, running: 'full-access', inheritedFullAccess: undefined })
    ).toEqual([])
  })
})
