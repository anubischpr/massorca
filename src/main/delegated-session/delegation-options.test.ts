import { describe, expect, it } from 'vitest'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import type { ProviderRateLimits, RateLimitWindow } from '../../shared/rate-limit-types'
import { buildDelegationCardContent, routeDelegationRequest } from './delegation-options'
import type { DelegationStoredAgent } from './delegation-options'

const NOW = 1_800_000_000_000

function window(usedPercent: number): RateLimitWindow {
  return { usedPercent, windowMinutes: 300, resetsAt: null, resetDescription: null }
}

function provider(
  name: ProviderRateLimits['provider'],
  session: number,
  weekly = session
): ProviderRateLimits {
  return {
    provider: name,
    session: window(session),
    weekly: window(weekly),
    updatedAt: NOW - 60_000,
    error: null,
    status: 'ok'
  }
}

const AGENTS: DelegationStoredAgent[] = [
  { agent: 'claude', label: 'Claude' },
  { agent: 'codex', label: 'Codex' },
  { agent: 'grok', label: 'Grok' }
]

const base = {
  summary: 'Implement the retry helper and add tests',
  writes: true,
  workspaceKind: 'git' as const,
  parentAgent: 'claude',
  agents: AGENTS,
  now: NOW
}

describe('routeDelegationRequest', () => {
  it('picks the agent with the lowest binding usage', () => {
    const rateLimits = createEmptyRateLimitState({
      claude: provider('claude', 71),
      codex: provider('codex', 34)
    })
    const route = routeDelegationRequest({ ...base, rateLimits })

    expect(route.status).toBe('routed')
    expect(route.status === 'routed' && route.decision.agent).toBe('codex')
  })

  it('treats a host with no usage reading as no data for every agent', () => {
    const route = routeDelegationRequest({ ...base, rateLimits: null })

    expect(route.status === 'routed' && route.decision.reasons).toContain('no-usage-data')
    expect(route.status === 'routed' && route.decision.agent).toBe('claude')
  })

  it('asks for no effort where no model is named, since worker-start refuses that pairing', () => {
    const route = routeDelegationRequest({
      ...base,
      agents: [{ agent: 'grok', label: 'Grok' }],
      rateLimits: null
    })

    expect(route.status === 'routed' && route.decision).toMatchObject({
      agent: 'grok',
      model: null,
      effort: null
    })
  })

  it('clamps an effort the tier model cannot take to what worker-start accepts', () => {
    // A small read-only task maps to Claude Haiku, and Haiku lists no effort level at all.
    const route = routeDelegationRequest({
      ...base,
      summary: 'List the files in the docs folder',
      writes: false,
      agents: [{ agent: 'claude', label: 'Claude' }],
      rateLimits: null
    })

    expect(route.status === 'routed' && route.decision).toMatchObject({
      agent: 'claude',
      model: 'haiku',
      effort: null
    })
  })

  it('reports no eligible agent when every agent is past its limit', () => {
    const rateLimits = createEmptyRateLimitState({
      claude: provider('claude', 96),
      codex: provider('codex', 100)
    })
    const route = routeDelegationRequest({ ...base, agents: AGENTS.slice(0, 2), rateLimits })

    expect(route.status).toBe('no-eligible-agent')
  })
})

describe('buildDelegationCardContent', () => {
  const rateLimits = createEmptyRateLimitState({
    claude: provider('claude', 71),
    codex: provider('codex', 34)
  })

  function card(overrides: Partial<Parameters<typeof routeDelegationRequest>[0]> = {}) {
    const input = { ...base, rateLimits, ...overrides }
    return buildDelegationCardContent({
      requestId: 'deleg_aaaaaaaaaaaa',
      title: 'Retry helper',
      route: routeDelegationRequest(input),
      agents: input.agents,
      writes: input.writes,
      workspaceKind: input.workspaceKind
    })
  }

  it('lists Automatic first, then each agent lowest usage first (no data counts as 60%), in words an older client reads', () => {
    const { options, payload } = card()

    expect(options.map((option) => option.id)).toEqual([
      'automatic',
      'agent:codex',
      'agent:grok',
      'agent:claude'
    ])
    expect(options[0]).toMatchObject({
      label: 'Automatic',
      description: expect.stringContaining('Codex')
    })
    expect(options[1]).toMatchObject({ label: 'Codex' })
    expect(options[1]?.description).toBe(
      ['34% used', payload.agents[0]?.model, payload.agents[0]?.effort].join(' · ')
    )
    expect(options[2]?.description).toMatch(/^No usage data/)
    expect(options[3]?.description).toMatch(/^71% used · (haiku|sonnet|opus)/)
  })

  it('carries the typed payload a rich client draws beside the plain options', () => {
    const { payload } = card()

    expect(payload).toMatchObject({
      requestId: 'deleg_aaaaaaaaaaaa',
      title: 'Retry helper',
      placement: 'new-child',
      placementWarning: null
    })
    expect(payload.decision?.agent).toBe('codex')
    expect(payload.agents.map((entry) => entry.agent)).toEqual(['codex', 'grok', 'claude'])
    expect(payload.agents[0]).toMatchObject({ label: 'Codex', model: payload.decision?.model })
  })

  it('offers no Automatic when no agent has headroom, and names a limit', () => {
    const exhausted = createEmptyRateLimitState({
      claude: provider('claude', 100),
      codex: provider('codex', 93)
    })
    const { options, payload } = card({ agents: AGENTS.slice(0, 2), rateLimits: exhausted })

    expect(options.map((option) => option.id)).toEqual(['agent:codex', 'agent:claude'])
    expect(options[1]?.description).toMatch(/^Limit reached/)
    expect(options[0]?.description).toMatch(/near its limit/)
    expect(payload.decision).toBeNull()
  })

  it('flags a folder workspace that will be written in place', () => {
    const { payload } = card({ workspaceKind: 'folder' })

    expect(payload).toMatchObject({
      placement: 'current',
      placementWarning: 'folder-workspace-writes'
    })
  })
})
