import { describe, expect, it } from 'vitest'
import type {
  DelegationDecision,
  DelegationRouteResult
} from '../../shared/delegated-session-types'
import { decideDelegation, type DelegationRouteInput } from './delegation-router'

const NOW = 1_800_000_000_000
const FRESH = NOW - 60_000

function routeInput(overrides: Partial<DelegationRouteInput> = {}): DelegationRouteInput {
  return {
    summary: 'Summarize the changelog',
    writesCode: false,
    workspaceKind: 'git',
    parentAgent: null,
    candidates: [
      { agent: 'claude', usage: { sessionPercent: 10, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 50, fetchedAt: FRESH } }
    ],
    now: NOW,
    ...overrides
  }
}

function routed(result: DelegationRouteResult): DelegationDecision {
  if (result.status !== 'routed') {
    throw new Error(`expected a routed decision, got ${result.status}`)
  }
  return result.decision
}

describe('decideDelegation', () => {
  it('routes a code-writing task to a new child worktree with the lowest-usage agent', () => {
    const decision = routed(
      decideDelegation(routeInput({ summary: 'Implement the parser fix', writesCode: true }))
    )
    expect(decision).toMatchObject({
      agent: 'claude',
      model: 'sonnet',
      effort: 'medium',
      tier: 3,
      placement: 'new-child',
      placementWarning: null,
      reasons: ['lowest-usage', 'writes-new-child-worktree']
    })
  })

  it('keeps a read-only exploration in the current worktree and maps codex models', () => {
    const decision = routed(
      decideDelegation(
        routeInput({
          summary: 'Explore the new tool and list its features to adopt, read-only',
          candidates: [
            { agent: 'claude', usage: { sessionPercent: 80, fetchedAt: FRESH } },
            { agent: 'codex', usage: { sessionPercent: 20, fetchedAt: FRESH } }
          ]
        })
      )
    )
    expect(decision).toMatchObject({
      agent: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'medium',
      tier: 3,
      placement: 'current',
      placementWarning: null,
      reasons: ['lowest-usage', 'read-only-current-worktree']
    })
  })

  it('keeps folder-workspace writes in the current folder with a warning', () => {
    const decision = routed(
      decideDelegation(
        routeInput({
          summary: 'Implement the parser fix',
          writesCode: true,
          workspaceKind: 'folder'
        })
      )
    )
    expect(decision).toMatchObject({
      placement: 'current',
      placementWarning: 'folder-workspace-writes',
      reasons: ['lowest-usage', 'folder-workspace-writes']
    })
  })

  it('adds the no-usage-data reason when the winner has no fresh data', () => {
    const decision = routed(
      decideDelegation(
        routeInput({
          candidates: [
            { agent: 'claude', usage: null },
            { agent: 'codex', usage: { sessionPercent: 80, fetchedAt: FRESH } }
          ]
        })
      )
    )
    expect(decision).toMatchObject({
      agent: 'claude',
      reasons: ['lowest-usage', 'no-usage-data', 'read-only-current-worktree']
    })
  })

  it('records the high-risk tier floor', () => {
    const decision = routed(decideDelegation(routeInput({ summary: 'Delete the stale cache' })))
    expect(decision).toMatchObject({
      agent: 'claude',
      model: 'sonnet',
      effort: 'high',
      tier: 4,
      reasons: ['lowest-usage', 'high-risk-tier-floor', 'read-only-current-worktree']
    })
  })

  it('drops the effort with a model the catalog does not list', () => {
    const decision = routed(
      decideDelegation(
        routeInput({
          summary: 'Rename the exact field and run the tests',
          catalogs: { claude: { models: ['sonnet', 'opus'], efforts: ['low', 'medium'] } }
        })
      )
    )
    expect(decision).toMatchObject({
      agent: 'claude',
      model: null,
      effort: null,
      tier: 1,
      reasons: ['lowest-usage', 'model-unavailable', 'read-only-current-worktree']
    })
  })

  it('clamps the effort to a listed model from the catalog', () => {
    const decision = routed(
      decideDelegation(
        routeInput({
          summary: 'Rename the exact field and run the tests',
          catalogs: { claude: { models: ['haiku'], efforts: ['low', 'medium'] } }
        })
      )
    )
    expect(decision).toMatchObject({
      model: 'haiku',
      effort: 'medium',
      reasons: ['lowest-usage', 'effort-clamped', 'read-only-current-worktree']
    })
  })

  it('reports no eligible agent for an empty candidate list', () => {
    expect(decideDelegation(routeInput({ candidates: [] }))).toEqual({
      status: 'no-eligible-agent',
      tier: 2,
      dimensions: {
        risk: 'low',
        complexity: 'medium',
        verifiability: 'medium',
        ambiguity: 'medium'
      },
      ranking: []
    })
  })

  it('reports no eligible agent with the tier and the ranking when every agent is excluded', () => {
    const result = decideDelegation(
      routeInput({
        candidates: [{ agent: 'claude', usage: { sessionPercent: 95, fetchedAt: FRESH } }]
      })
    )
    expect(result).toMatchObject({
      status: 'no-eligible-agent',
      tier: 2,
      ranking: [{ agent: 'claude', excluded: 'usage-limit' }]
    })
  })

  it('returns the same decision for the same inputs in any candidate order', () => {
    const candidates = [
      { agent: 'claude', usage: { sessionPercent: 30, fetchedAt: FRESH } },
      { agent: 'codex', usage: { sessionPercent: 34, fetchedAt: FRESH } },
      { agent: 'pi', usage: null }
    ]
    const forward = routeInput({ parentAgent: 'codex', candidates })
    const reversed = routeInput({ parentAgent: 'codex', candidates: candidates.toReversed() })
    expect(decideDelegation(reversed)).toEqual(decideDelegation(forward))
    expect(routed(decideDelegation(forward))).toMatchObject({
      agent: 'codex',
      reasons: ['parent-agent-tie', 'read-only-current-worktree']
    })
  })
})
