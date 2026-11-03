import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration } from './commit-message-plan'

describe('web research', () => {
  const WEB_ONLY = ['WebSearch', 'WebFetch']

  it('lets Claude use only the web tools when research is asked for', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'claude', model: 'sonnet', webResearch: true },
      'PROMPT'
    )
    if (!result.ok) {
      throw new Error(result.error)
    }
    const { args } = result.plan
    expect(args[args.indexOf('--tools') + 1]).toBe(WEB_ONLY.join(','))
    expect(args[args.indexOf('--allowedTools') + 1]).toBe(WEB_ONLY.join(','))
    expect(result.plan.webResearch).toBe(true)
    expect(args.join(' ')).not.toMatch(/Bash|Write|Edit|--mcp-config/)
    expect(args).toContain('--strict-mcp-config')
  })

  it('keeps the commit-message plan without any tool, whatever the agent', () => {
    const claude = planCommitMessageGeneration({ agentId: 'claude', model: 'sonnet' }, 'P')
    if (!claude.ok) {
      throw new Error(claude.error)
    }
    expect(claude.plan.args).not.toContain('--tools')
    expect(claude.plan.args).not.toContain('--allowedTools')
    expect(claude.plan.args.join(' ')).not.toContain('Web')
    expect(claude.plan.webResearch).toBeUndefined()
  })

  it('turns on live web search for Codex only on a research turn, keeping the read-only sandbox', () => {
    const research = planCommitMessageGeneration(
      { agentId: 'codex', model: 'gpt-5.5', webResearch: true },
      'P'
    )
    const plain = planCommitMessageGeneration({ agentId: 'codex', model: 'gpt-5.5' }, 'P')
    if (!research.ok || !plain.ok) {
      throw new Error('plan failed')
    }
    expect(research.plan.args.join(' ')).toContain('-c web_search="live"')
    expect(research.plan.args.join(' ')).toContain('-s read-only')
    expect(research.plan.webResearch).toBe(true)
    expect(plain.plan.args.join(' ')).not.toContain('web_search')
  })

  it('gives Antigravity the research timeout with its usual sandboxed flags', () => {
    const research = planCommitMessageGeneration(
      { agentId: 'antigravity', model: 'default', webResearch: true },
      'P'
    )
    const plain = planCommitMessageGeneration({ agentId: 'antigravity', model: 'default' }, 'P')
    if (!research.ok || !plain.ok) {
      throw new Error('plan failed')
    }
    expect(research.plan.args).toEqual(plain.plan.args)
    expect(research.plan.args).toContain('--sandbox')
    expect(research.plan.webResearch).toBe(true)
  })

  it('falls back to text only for an agent with no confirmed web-only mode', () => {
    const pi = planCommitMessageGeneration(
      { agentId: 'pi', model: 'default', webResearch: true },
      'P'
    )
    const plain = planCommitMessageGeneration({ agentId: 'pi', model: 'default' }, 'P')
    if (!pi.ok || !plain.ok) {
      throw new Error('plan failed')
    }
    expect(pi.plan.args).toEqual(plain.plan.args)
    expect(pi.plan.args).toContain('--no-tools')
    expect(pi.plan.webResearch).toBeUndefined()
  })
})
