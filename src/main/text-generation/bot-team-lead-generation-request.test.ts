import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.hoisted(() =>
  vi.fn(async (_input: { plan: Record<string, unknown>; timeoutMs?: number }) => ({
    success: true as const,
    rawOutput: 'answer'
  }))
)
vi.mock('./source-control-text-generation-requests', () => ({
  executeGenerationPlan: execute,
  commandBackslashMode: () => 'escape'
}))

import { queryBotTeamLead } from './bot-team-lead-generation-request'

const target = { kind: 'local', cwd: '.' } as never
const spawnAgent = vi.fn() as never

describe('queryBotTeamLead', () => {
  beforeEach(() => execute.mockClear())

  it('keeps a plain turn text-only with the short timeout', async () => {
    await queryBotTeamLead({
      prompt: 'p',
      params: { agentId: 'claude', model: 'sonnet' },
      target,
      spawnAgent
    })
    const [{ plan, timeoutMs }] = execute.mock.calls[0]
    expect(plan.args).not.toContain('--tools')
    expect(timeoutMs).toBe(45_000)
  })

  it('gives a research turn the web tools and a longer timeout, without leaking the flag to the plan', async () => {
    await queryBotTeamLead({
      prompt: 'p',
      params: { agentId: 'claude', model: 'sonnet' },
      target,
      spawnAgent,
      webResearch: true
    })
    const [{ plan, timeoutMs }] = execute.mock.calls[0]
    expect(plan.args).toEqual(expect.arrayContaining(['--tools', 'WebSearch,WebFetch']))
    expect(plan).not.toHaveProperty('webResearch')
    expect(timeoutMs).toBe(120_000)
  })

  it('stays text-only with the short timeout for an agent with no web-only mode', async () => {
    await queryBotTeamLead({
      prompt: 'p',
      params: { agentId: 'pi', model: 'default' },
      target,
      spawnAgent,
      webResearch: true
    })
    const [{ plan, timeoutMs }] = execute.mock.calls[0]
    expect(plan.args).toContain('--no-tools')
    expect(timeoutMs).toBe(45_000)
  })

  it('gives a code turn the read-only code tools and the longest timeout, without leaking the flag', async () => {
    await queryBotTeamLead({
      prompt: 'p',
      params: { agentId: 'claude', model: 'sonnet' },
      target,
      spawnAgent,
      codeRead: true
    })
    const [{ plan, timeoutMs }] = execute.mock.calls[0]
    expect(plan.args).toEqual(expect.arrayContaining(['--tools', 'Read,Grep,Glob']))
    expect(plan).not.toHaveProperty('codeRead')
    expect(timeoutMs).toBe(180_000)
  })

  it('isolates a Codex room turn from the user config, without leaking the flag to the plan', async () => {
    await queryBotTeamLead({
      prompt: 'p',
      params: { agentId: 'codex', model: 'gpt-5.5' },
      target,
      spawnAgent
    })
    const [{ plan }] = execute.mock.calls[0]
    expect(plan.args).toEqual(expect.arrayContaining(['--ignore-user-config', '--disable', 'apps']))
    expect(plan).not.toHaveProperty('roomTurn')
  })

  it('stays text-only with the short timeout for a code turn on an agent with no code read mode', async () => {
    await queryBotTeamLead({
      prompt: 'p',
      params: { agentId: 'opencode', model: 'default' },
      target,
      spawnAgent,
      codeRead: true
    })
    const [{ timeoutMs }] = execute.mock.calls[0]
    expect(timeoutMs).toBe(45_000)
  })
})
