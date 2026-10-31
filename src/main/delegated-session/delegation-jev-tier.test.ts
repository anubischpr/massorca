import { describe, expect, it, vi } from 'vitest'
import type { DelegationRouteResult } from '../../shared/delegated-session-types'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import { createJevDelegationTierAdvisor } from './delegation-jev-tier'
import {
  routeDelegationRequest,
  routeDelegationRequestWithAdvice,
  type DelegationRoutingInput
} from './delegation-options'
import { resolveDelegationTarget } from './delegation-stored-request'

const INPUT: DelegationRoutingInput = {
  summary: 'Implement the parser fix',
  writes: true,
  workspaceKind: 'git',
  parentAgent: 'claude',
  agents: [{ agent: 'claude', label: 'Claude' }],
  rateLimits: null,
  now: 1_800_000_000_000
}

function decisionOf(route: DelegationRouteResult) {
  if (route.status !== 'routed') {
    throw new Error(`expected a routed decision, got ${route.status}`)
  }
  return route.decision
}

function jevAnswering(choice: string) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          model: 'jev-1.2.3',
          answers: { decision: { type: 'choice', choice, confidence: 0.8 } }
        })
      )
  )
}

function advisorWith(fetchImpl: typeof fetch, enabled = true) {
  return createJevDelegationTierAdvisor({
    isEnabled: () => enabled,
    readApiKey: () => 'test-key',
    fetchImpl
  })
}

describe('delegation routing with Jev', () => {
  const deterministic = routeDelegationRequest(INPUT)

  it('is exactly the deterministic route while the toggle is off, with no call', async () => {
    const fetchImpl = jevAnswering('tier-5')

    const route = await routeDelegationRequestWithAdvice(INPUT, advisorWith(fetchImpl, false))

    expect(route).toEqual(deterministic)
    expect(JSON.stringify(route)).toBe(JSON.stringify(deterministic))
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('is exactly the deterministic route when no advisor is wired', async () => {
    await expect(routeDelegationRequestWithAdvice(INPUT, undefined)).resolves.toEqual(deterministic)
  })

  it.each([
    ['an HTTP failure', async () => new Response('', { status: 503 })],
    [
      'a network failure',
      async () => {
        throw new Error('offline')
      }
    ],
    ['an unknown tier', async () => new Response('{"model":"jev-1.0.0","answers":{}}')]
  ])('is exactly the deterministic route on %s', async (_name, respond) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const route = await routeDelegationRequestWithAdvice(
      INPUT,
      advisorWith(vi.fn<typeof fetch>(respond))
    )

    expect(JSON.stringify(route)).toBe(JSON.stringify(deterministic))
    warn.mockRestore()
  })

  it('is exactly the deterministic route when the advisor throws', async () => {
    const route = await routeDelegationRequestWithAdvice(INPUT, async () => {
      throw new Error('unexpected')
    })

    expect(JSON.stringify(route)).toBe(JSON.stringify(deterministic))
  })

  it('does not send a summary that fails the privacy filter', async () => {
    const fetchImpl = jevAnswering('tier-5')
    const input = { ...INPUT, summary: 'Fix src/main/index.ts' }

    const route = await routeDelegationRequestWithAdvice(input, advisorWith(fetchImpl))

    expect(route).toEqual(routeDelegationRequest(input))
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('makes no paid call when no agent can start', async () => {
    const fetchImpl = jevAnswering('tier-5')
    const input = { ...INPUT, agents: [] }

    await routeDelegationRequestWithAdvice(input, advisorWith(fetchImpl))

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('uses the tier Jev picks and marks the decision', async () => {
    const decision = decisionOf(
      await routeDelegationRequestWithAdvice(INPUT, advisorWith(jevAnswering('tier-5')))
    )

    expect(decision.tier).toBe(5)
    expect(decision.tierAdvisedBy).toBe('jev')
    expect(decision.agent).toBe(decisionOf(deterministic).agent)
    expect(decision.placement).toBe(decisionOf(deterministic).placement)
  })

  it('never lets Jev lower a high-risk task below the floor', async () => {
    const input = { ...INPUT, summary: 'Run the database migration' }

    const decision = decisionOf(
      await routeDelegationRequestWithAdvice(input, advisorWith(jevAnswering('tier-1')))
    )

    expect(decision.tier).toBe(4)
    expect(decision.reasons).toContain('high-risk-tier-floor')
  })

  it('starts a picked agent on the tier the card showed', async () => {
    const decision = decisionOf(
      await routeDelegationRequestWithAdvice(INPUT, advisorWith(jevAnswering('tier-5')))
    )
    const row = {
      choice: 'agent:claude',
      summary: INPUT.summary,
      writes: 1,
      workspace_kind: 'git',
      options_json: JSON.stringify({ agents: INPUT.agents }),
      decision_json: JSON.stringify(decision)
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: resolveDelegationTarget reads only the fields set above.
    const target = resolveDelegationTarget(row as DelegationRequestRow)

    expect(target?.model).toBe(decision.model)
    expect(target?.effort).toBe(decision.effort)
  })
})
