import { describe, expect, it } from 'vitest'
import type { DelegationCardPayload } from '../../../src/shared/delegated-session-journal'
import type {
  DelegationAgentUsage,
  DelegationDecision
} from '../../../src/shared/delegated-session-types'
import {
  automaticPickText,
  automaticWhyHeading,
  defaultDelegationOption,
  delegationBarPercent,
  delegationDimensionCells,
  delegationModelLines,
  delegationOptionRows,
  delegationPlacementLines,
  delegationPlacementText,
  delegationRankRows,
  delegationTaskLines,
  delegationUsageText,
  delegationWinnerLines,
  modelEffortText
} from './mobile-delegation-card-model'

function usage(
  agent: string,
  bindingPercent: number,
  window: DelegationAgentUsage['window'],
  overrides: Partial<DelegationAgentUsage> = {}
): DelegationAgentUsage {
  return { agent, bindingPercent, window, noData: false, excluded: null, ...overrides }
}

const decision: DelegationDecision = {
  agent: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  tier: 3,
  dimensions: { risk: 'low', complexity: 'medium', verifiability: 'medium', ambiguity: 'medium' },
  placement: 'current',
  placementWarning: null,
  ranking: [
    usage('codex', 34, 'weekly'),
    usage('antigravity', 41, 'session'),
    usage('claude', 72, 'session', { excluded: 'usage-limit' }),
    usage('opencode', 60, null, { noData: true }),
    usage('gentle-shell', 100, 'session', { excluded: 'limit-reached' })
  ],
  reasons: ['lowest-usage', 'read-only-current-worktree']
}

function card(overrides: Partial<DelegationCardPayload> = {}): DelegationCardPayload {
  return {
    requestId: 'request-1',
    title: 'Explore Gentle Shell v5',
    decision,
    agents: [
      {
        agent: 'codex',
        label: 'Codex',
        usage: usage('codex', 34, 'weekly'),
        model: 'gpt-6.1-sol',
        effort: 'medium'
      },
      {
        agent: 'antigravity',
        label: 'Antigravity',
        usage: usage('antigravity', 41, 'session'),
        model: null,
        effort: 'medium'
      },
      {
        agent: 'claude',
        label: 'Claude',
        usage: usage('claude', 72, 'session', { excluded: 'usage-limit' }),
        model: 'sonnet',
        effort: 'medium'
      },
      {
        agent: 'opencode',
        label: 'OpenCode',
        usage: usage('opencode', 60, null, { noData: true }),
        model: null,
        effort: null
      },
      {
        agent: 'gentle-shell',
        label: 'Gentle Shell',
        usage: usage('gentle-shell', 100, 'session', { excluded: 'limit-reached' }),
        model: null,
        effort: null
      }
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
      'agent:antigravity',
      'agent:claude',
      'agent:opencode',
      'agent:gentle-shell'
    ])
    expect(rows[0]).toMatchObject({
      label: 'Automatic',
      usageText: 'Picks Codex',
      detail: 'Chooses by usage, then model and effort by task',
      barPercent: null,
      agentId: null
    })
  })

  it('draws each agent with its usage, bar and model line, and flags the ones at a limit', () => {
    const [, codex, , claude, opencode, gentleShell] = delegationOptionRows(card())

    expect(codex).toMatchObject({
      label: 'Codex',
      usageText: '34% used',
      barPercent: 34,
      detail: 'gpt-6.1-sol · medium',
      excluded: false
    })
    expect(claude).toMatchObject({
      usageText: '72% used · near its limit',
      barPercent: 72,
      excluded: true
    })
    expect(opencode).toMatchObject({ usageText: 'No usage data', barPercent: null })
    expect(gentleShell).toMatchObject({
      usageText: 'Limit reached',
      barPercent: null,
      excluded: true
    })
  })

  it('omits Automatic and selects nothing when no agent has headroom', () => {
    const rows = delegationOptionRows(card({ decision: null }))

    expect(rows[0]?.optionId).toBe('agent:codex')
    expect(defaultDelegationOption(card({ decision: null }))).toBeNull()
    expect(defaultDelegationOption(card())).toBe('automatic')
  })
})

describe('usage presentation', () => {
  it('clamps the bar and draws none for unknown or exhausted usage', () => {
    expect(delegationBarPercent(usage('codex', 140, 'weekly'))).toBe(100)
    expect(delegationBarPercent(usage('codex', -3, 'weekly'))).toBe(0)
    expect(delegationBarPercent(usage('codex', 60, null, { noData: true }))).toBeNull()
    expect(
      delegationBarPercent(usage('codex', 100, 'session', { excluded: 'limit-reached' }))
    ).toBeNull()
  })

  it('rounds the percent it prints', () => {
    expect(delegationUsageText(usage('codex', 33.6, 'weekly'))).toBe('34% used')
  })
})

describe('why sheet', () => {
  it('ranks every agent with the picked one marked and its window or no-data note', () => {
    const rows = delegationRankRows(card(), decision)

    expect(rows.map((row) => [row.label, row.valueText, row.windowText, row.picked])).toEqual([
      ['Codex', '34%', 'weekly window', true],
      ['Antigravity', '41%', '5h window', false],
      ['Claude', '72%', '5h window', false],
      ['OpenCode', 'No data', 'Counted as 60%', false],
      ['Gentle Shell', 'Limit reached', '5h window', false]
    ])
    expect(rows.map((row) => row.excluded)).toEqual([false, false, true, false, true])
  })

  it('names the task dimensions as level cells', () => {
    expect(delegationDimensionCells(decision.dimensions)).toEqual([
      { title: 'Risk', value: 'Low' },
      { title: 'Complexity', value: 'Medium' },
      { title: 'Verifiability', value: 'Medium' },
      { title: 'Ambiguity', value: 'Medium' }
    ])
  })

  it('words the reasons that apply, and drops codes it has no text for', () => {
    expect(delegationWinnerLines(decision)).toEqual(['Lowest usage'])
    expect(
      delegationWinnerLines({
        ...decision,
        reasons: ['parent-agent-tie', 'no-usage-data']
      })
    ).toEqual(["Within 5 points of the lowest usage, so the parent's agent wins"])
    expect(delegationTaskLines(decision)).toEqual([])
    expect(delegationTaskLines({ ...decision, reasons: ['high-risk-tier-floor'] })).toEqual([
      'High risk raises the task to tier 4'
    ])
    expect(
      delegationModelLines({ ...decision, reasons: ['model-unavailable', 'effort-clamped'] })
    ).toEqual([
      'This agent has no model for this tier, so its default runs',
      'Effort is lowered to what this agent supports'
    ])
  })

  it('says where the child runs and why', () => {
    expect(delegationPlacementText('current')).toBe('This worktree')
    expect(delegationPlacementText('new-child')).toBe('New child worktree')
    expect(delegationPlacementLines('current', null)).toEqual([
      'Read-only task, so it runs in this worktree'
    ])
    expect(delegationPlacementLines('new-child', null)).toEqual([
      'Writes code, so it gets its own worktree'
    ])
    expect(delegationPlacementLines('current', 'folder-workspace-writes')).toEqual([
      'Folder workspace, so writes land in this folder'
    ])
  })

  it('names the pick in its heading and its summary line', () => {
    expect(automaticWhyHeading(card(), 'codex')).toBe('Why Automatic picked Codex')
    expect(automaticPickText(card(), decision)).toBe('Picks Codex · gpt-6.1-sol · medium')
  })

  it('reads a missing model as the default model', () => {
    expect(modelEffortText(null, 'medium')).toBe('Default model · medium')
    expect(modelEffortText('sonnet', null)).toBe('sonnet')
  })
})
