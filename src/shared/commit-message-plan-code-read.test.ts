import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration } from './commit-message-plan'

type AgentId = 'claude' | 'codex' | 'antigravity' | 'pi' | 'opencode'

function plan(
  agentId: AgentId,
  extra: { codeRead?: boolean; webResearch?: boolean; agentCommandOverride?: string } = {}
) {
  const result = planCommitMessageGeneration(
    { agentId, model: agentId === 'codex' ? 'gpt-5.5' : 'default', ...extra },
    'P'
  )
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.plan
}

const after = (args: string[], flag: string): string[] =>
  (args[args.indexOf(flag) + 1] ?? '').split(',')

describe('code read mode', () => {
  it('lets Claude read, search and list files, keeps the user MCP config, and denies every write', () => {
    const claude = planCommitMessageGeneration(
      { agentId: 'claude', model: 'sonnet', codeRead: true },
      'P'
    )
    if (!claude.ok) {
      throw new Error(claude.error)
    }
    const { args, codeRead } = claude.plan
    expect(codeRead).toBe(true)
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
    expect(after(args, '--tools')).toEqual(['Read', 'Grep', 'Glob'])
    expect(after(args, '--allowedTools')).toEqual(['Read', 'Grep', 'Glob', 'mcp__openmetadata__*'])
    expect(after(args, '--disallowedTools')).toEqual(
      expect.arrayContaining([
        'mcp__openmetadata-escritura__*',
        'mcp__openmetadata__patch_entity',
        'Bash',
        'Edit',
        'Write',
        'NotebookEdit'
      ])
    )
    expect(args).not.toContain('--strict-mcp-config')
  })

  it('adds the web tools to Claude only when the turn is also research, without repeating a flag', () => {
    const claude = planCommitMessageGeneration(
      { agentId: 'claude', model: 'sonnet', codeRead: true, webResearch: true },
      'P'
    )
    if (!claude.ok) {
      throw new Error(claude.error)
    }
    const { args, webResearch } = claude.plan
    expect(webResearch).toBe(true)
    expect(after(args, '--tools')).toEqual(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'])
    expect(args.filter((arg) => arg === '--tools')).toHaveLength(1)
    expect(args.filter((arg) => arg === '--allowedTools')).toHaveLength(1)
  })

  it('gives no code read mode to Codex or Antigravity, which cannot limit MCP write tools', () => {
    for (const agentId of ['codex', 'antigravity'] as const) {
      const asked = plan(agentId, { codeRead: true })
      expect(asked.codeRead).toBeUndefined()
      expect(asked.args).toEqual(plan(agentId).args)
    }
  })

  it('swaps Pi no-tools for its read-only allowlist, after the Gentle Shell separator', () => {
    const { args, binary } = plan('pi', {
      codeRead: true,
      agentCommandOverride: 'gentle-shell --'
    })
    expect(binary).toBe('gentle-shell')
    expect(args[0]).toBe('--')
    expect(args).not.toContain('--no-tools')
    expect(args.slice(-2)).toEqual(['--tools', 'read,grep,find,ls'])
  })

  it('does nothing for an agent with no code read mode', () => {
    const asked = plan('opencode', { codeRead: true })
    expect(asked.codeRead).toBeUndefined()
    expect(asked.args).toEqual(plan('opencode').args)
  })

  it('leaves the commit-message plan with no tool, whatever the agent', () => {
    for (const agentId of ['claude', 'codex', 'antigravity', 'pi'] as const) {
      const { args, codeRead, webResearch } = plan(agentId)
      expect(codeRead).toBeUndefined()
      expect(webResearch).toBeUndefined()
      expect(args).not.toContain('--allowedTools')
    }
    expect(plan('claude').args).not.toContain('--tools')
    expect(plan('pi').args).toContain('--no-tools')
  })
})
