import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration } from '../../shared/commit-message-plan'
import {
  newestLunaModelId,
  replySuggestionCommandOverride,
  selectReplySuggestionAgent
} from './reply-suggestion-agent-selection'

const NO_MODELS: string[] = []
const base: { sessionModel: string | undefined; codexModelIds: string[] } = {
  sessionModel: undefined,
  codexModelIds: NO_MODELS
}

describe('selectReplySuggestionAgent', () => {
  it('asks Haiku for Claude regardless of the chat model', () => {
    expect(
      selectReplySuggestionAgent({ ...base, provider: 'claude', sessionModel: 'opus' })
    ).toEqual({ agentId: 'claude', model: 'haiku' })
  })

  it('prefers the newest Luna model of the Codex catalog, else the chat model', () => {
    const codexModelIds = ['gpt-5.5', 'gpt-5.6-luna', 'gpt-6-luna', 'gpt-5.6-terra']
    expect(selectReplySuggestionAgent({ ...base, provider: 'codex', codexModelIds })).toEqual({
      agentId: 'codex',
      model: 'gpt-6-luna'
    })
    expect(
      selectReplySuggestionAgent({ ...base, provider: 'codex', sessionModel: 'gpt-5.5' })
    ).toEqual({ agentId: 'codex', model: 'gpt-5.5' })
    expect(selectReplySuggestionAgent({ ...base, provider: 'codex' })).toBeNull()
  })

  it('inherits the chat model for Pi (Gentle Shell included) and Antigravity', () => {
    expect(selectReplySuggestionAgent({ ...base, provider: 'pi', sessionModel: 'p/m' })).toEqual({
      agentId: 'pi',
      model: 'p/m'
    })
    expect(selectReplySuggestionAgent({ ...base, provider: 'antigravity' })).toEqual({
      agentId: 'antigravity',
      model: 'default'
    })
  })

  it('has no one-shot mode for other agents', () => {
    expect(selectReplySuggestionAgent({ ...base, provider: 'opencode' })).toBeNull()
  })
})

describe('newestLunaModelId', () => {
  it('orders versions numerically', () => {
    expect(newestLunaModelId(['gpt-5.9-luna', 'gpt-5.10-luna'])).toBe('gpt-5.10-luna')
    expect(newestLunaModelId(['gpt-5.5'])).toBeNull()
  })
})

describe('replySuggestionCommandOverride', () => {
  it('runs Gentle Shell with the Pi arguments after the separator', () => {
    expect(replySuggestionCommandOverride('pi', 'gentle-shell', {})).toBe('gentle-shell --')
  })

  it('keeps a configured Gentle Shell command and its own options', () => {
    const settings = { agentCmdOverrides: { pi: '/opt/bin/gentle-shell --isolated' } }
    expect(replySuggestionCommandOverride('pi', 'gentle-shell', settings)).toBe(
      '/opt/bin/gentle-shell --isolated --'
    )
  })

  it('never lends a Pi chat the Gentle Shell command, nor the reverse', () => {
    const gentle = { agentCmdOverrides: { pi: 'gentle-shell' } }
    expect(replySuggestionCommandOverride('pi', 'pi', gentle)).toBeUndefined()
    const stock = { agentCmdOverrides: { pi: '/usr/local/bin/pi' } }
    expect(replySuggestionCommandOverride('pi', 'pi', stock)).toBe('/usr/local/bin/pi')
    expect(replySuggestionCommandOverride('pi', 'gentle-shell', stock)).toBe('gentle-shell --')
  })

  it('passes other agents their configured command unchanged', () => {
    const settings = { agentCmdOverrides: { codex: ' /x/codex ' } }
    expect(replySuggestionCommandOverride('codex', 'pi', settings)).toBe('/x/codex')
    expect(replySuggestionCommandOverride('claude', 'pi', settings)).toBeUndefined()
  })
})

describe('the planned one-shot for Pi and Gentle Shell', () => {
  const plan = (runtime: 'pi' | 'gentle-shell') => {
    const planned = planCommitMessageGeneration(
      {
        agentId: 'pi',
        model: 'anthropic/sonnet',
        agentCommandOverride: replySuggestionCommandOverride('pi', runtime, {})
      },
      'PROMPT'
    )
    if (!planned.ok) {
      throw new Error(planned.error)
    }
    return planned.plan
  }

  it('keeps stock Pi on `pi --print` with no tools and the chat model', () => {
    const stock = plan('pi')
    expect(stock.binary).toBe('pi')
    expect(stock.args).toEqual(
      expect.arrayContaining([
        '--print',
        '--no-session',
        '--no-tools',
        '--model',
        'anthropic/sonnet'
      ])
    )
    expect(stock.args).not.toContain('--')
    expect(stock.stdinPayload).toBe('PROMPT')
  })

  it('puts the same arguments after `--` for Gentle Shell, still read-only', () => {
    const gentle = plan('gentle-shell')
    expect(gentle.binary).toBe('gentle-shell')
    expect(gentle.args[0]).toBe('--')
    expect(gentle.args.slice(1)).toEqual(plan('pi').args)
    expect(gentle.args).toEqual(expect.arrayContaining(['--print', '--no-tools']))
    expect(gentle.stdinPayload).toBe('PROMPT')
  })
})
