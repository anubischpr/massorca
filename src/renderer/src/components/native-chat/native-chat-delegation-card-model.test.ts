import { describe, expect, it } from 'vitest'
import type { DelegationCardPayload } from '../../../../shared/delegated-session-journal'
import type {
  DelegationAgentUsage,
  DelegationDecision
} from '../../../../shared/delegated-session-types'
import {
  defaultDelegationOption,
  delegationAutomaticFacts,
  delegationBarPercent,
  delegationManualFacts,
  delegationOptionRows,
  delegationUsageText
} from './native-chat-delegation-card-model'

function usage(agent: string, overrides: Partial<DelegationAgentUsage> = {}): DelegationAgentUsage {
  return {
    agent,
    bindingPercent: 34,
    window: 'weekly',
    noData: false,
    excluded: null,
    ...overrides
  }
}

const codexUsage = usage('codex')
const claudeUsage = usage('claude', { bindingPercent: 72, window: 'session' })
const openCodeUsage = usage('opencode', { bindingPercent: 60, window: null, noData: true })

const decision: DelegationDecision = {
  agent: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  tier: 3,
  dimensions: { risk: 'low', complexity: 'medium', verifiability: 'medium', ambiguity: 'medium' },
  placement: 'current',
  placementWarning: null,
  ranking: [codexUsage, claudeUsage, openCodeUsage],
  reasons: ['lowest-usage', 'read-only-current-worktree']
}

function card(overrides: Partial<DelegationCardPayload> = {}): DelegationCardPayload {
  return {
    requestId: 'req-1',
    title: 'Explore Gentle Shell v5',
    decision,
    agents: [
      { agent: 'codex', label: 'Codex', usage: codexUsage, model: 'gpt-6.1-sol', effort: 'medium' },
      { agent: 'claude', label: 'Claude', usage: claudeUsage, model: 'sonnet', effort: 'medium' },
      { agent: 'opencode', label: 'OpenCode', usage: openCodeUsage, model: null, effort: null }
    ],
    placement: 'current',
    placementWarning: null,
    ...overrides
  }
}

describe('delegation card rows', () => {
  it('lists Automatic first with the agent it picks, then every agent in ranking order', () => {
    const rows = delegationOptionRows(card())
    expect(rows.map((row) => row.optionId)).toEqual([
      'automatic',
      'agent:codex',
      'agent:claude',
      'agent:opencode'
    ])
    expect(rows[0]).toMatchObject({
      agentId: null,
      label: 'Automatic',
      usageText: 'Picks Codex',
      barPercent: null
    })
    expect(rows[1]).toMatchObject({
      agentId: 'codex',
      label: 'Codex',
      usageText: '34% used',
      excluded: false,
      barPercent: 34,
      detail: 'gpt-6.1-sol · medium'
    })
    expect(rows[3]).toMatchObject({
      usageText: 'No usage data',
      barPercent: null,
      detail: 'Default model'
    })
  })

  it('omits Automatic and selects nothing when no agent has headroom', () => {
    const rows = delegationOptionRows(card({ decision: null }))
    expect(rows.map((row) => row.optionId)).toEqual([
      'agent:codex',
      'agent:claude',
      'agent:opencode'
    ])
    expect(defaultDelegationOption(card({ decision: null }))).toBeNull()
    expect(defaultDelegationOption(card())).toBe('automatic')
  })
})

describe('delegation usage text', () => {
  it('names a reached limit, no data, and a near limit without a bar', () => {
    expect(
      delegationUsageText(usage('a', { excluded: 'limit-reached', bindingPercent: 100 }))
    ).toBe('Limit reached')
    expect(delegationUsageText(usage('a', { noData: true, bindingPercent: 60 }))).toBe(
      'No usage data'
    )
    const near = usage('a', { bindingPercent: 91, excluded: 'usage-limit' })
    expect(delegationUsageText(near)).toBe('91% used · near its limit')
    expect(delegationBarPercent(near)).toBe(91)
  })

  it('rounds the percentage and clamps the bar to 0–100', () => {
    expect(delegationUsageText(usage('a', { bindingPercent: 33.6 }))).toBe('34% used')
    expect(delegationBarPercent(usage('a', { bindingPercent: 150 }))).toBe(100)
    expect(delegationBarPercent(usage('a', { bindingPercent: -5 }))).toBe(0)
    expect(delegationBarPercent(usage('a', { noData: true }))).toBeNull()
    expect(delegationBarPercent(usage('a', { excluded: 'limit-reached' }))).toBeNull()
  })
})

describe('why Automatic picked an agent', () => {
  it('states the agent, the task tier, the model and the placement', () => {
    const facts = delegationAutomaticFacts(card(), decision)
    expect(facts.map((fact) => [fact.title, fact.value])).toEqual([
      ['Agent', 'Codex'],
      ['Task', 'Tier 3 of 5'],
      ['Model · effort', 'gpt-6.1-sol · medium'],
      ['Runs in', 'This worktree']
    ])
    expect(facts[0]?.lines).toEqual(['Lowest usage', '34% used, from the weekly window'])
    expect(facts[1]?.lines).toEqual([
      'Risk Low · Complexity Medium · Verifiability Medium · Ambiguity Medium'
    ])
    expect(facts[3]?.lines).toEqual(['Read-only task, so it runs in this worktree'])
  })

  it('words the tie, the risk floor, the model fallbacks and a folder workspace', () => {
    const folderDecision: DelegationDecision = {
      ...decision,
      placementWarning: 'folder-workspace-writes',
      ranking: [usage('codex', { bindingPercent: 60, window: null, noData: true })],
      reasons: [
        'parent-agent-tie',
        'no-usage-data',
        'high-risk-tier-floor',
        'model-unavailable',
        'effort-clamped',
        'folder-workspace-writes'
      ]
    }
    const facts = delegationAutomaticFacts(
      card({ placementWarning: 'folder-workspace-writes' }),
      folderDecision
    )
    expect(facts[0]?.lines).toEqual([
      "Within 5 points of the lowest usage, so the parent's agent wins",
      'No usage data, counted as 60%'
    ])
    expect(facts[1]?.lines).toEqual([
      'Risk Low · Complexity Medium · Verifiability Medium · Ambiguity Medium',
      'High risk raises the task to tier 4'
    ])
    expect(facts[2]?.lines).toEqual([
      'This agent has no model for this tier, so its default runs',
      'Effort is lowered to what this agent supports'
    ])
    expect(facts[3]?.lines).toEqual(['Folder workspace, so writes land in this folder'])
  })
})

describe('a manually picked agent', () => {
  it("shows the picked agent's own model and effort, with the same placement", () => {
    const [model, runsIn] = delegationManualFacts(card(), card().agents[1]!)
    expect(model).toMatchObject({ title: 'Model · effort', value: 'sonnet · medium', mono: true })
    expect(runsIn).toMatchObject({
      title: 'Runs in',
      value: 'This worktree',
      lines: ['Read-only task, so it runs in this worktree']
    })
  })

  it('names the default model and a new child worktree for a writing task', () => {
    const writing = card({ placement: 'new-child' })
    const [model, runsIn] = delegationManualFacts(writing, writing.agents[2]!)
    expect(model?.value).toBe('Default model')
    expect(runsIn).toMatchObject({
      value: 'New child worktree',
      lines: ['Writes code, so it gets its own worktree']
    })
  })
})
