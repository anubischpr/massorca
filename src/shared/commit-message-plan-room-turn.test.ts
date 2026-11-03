import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration } from './commit-message-plan'

// Why: the flags a Codex room turn carries, verified on codex-cli 0.159.2: the user's config is not
// loaded (its plugins and MCP servers are the tools that leaked), and the built-in apps, plugins,
// image generation and goals are off. Commit-message generation never gets them.
const CODEX_ROOM_TURN_FLAGS = [
  '--ignore-user-config',
  '--disable',
  'apps',
  '--disable',
  'plugins',
  '--disable',
  'image_generation',
  '--disable',
  'goals'
]

const CODEX_BASE = ['exec', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only']

describe('room-turn isolation', () => {
  it('gives a Codex room turn the isolation flags on top of the read-only sandbox', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'codex', model: 'gpt-5.5', roomTurn: true },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'codex',
        args: [...CODEX_BASE, '--model', 'gpt-5.5', ...CODEX_ROOM_TURN_FLAGS],
        stdinPayload: 'PROMPT',
        label: 'Codex'
      }
    })
  })

  it('keeps the effort override with the isolation flags on a Codex room turn', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'codex', model: 'gpt-5.5', thinkingLevel: 'low', roomTurn: true },
      'PROMPT'
    )

    if (!result.ok) {
      throw new Error('plan failed')
    }
    expect(result.plan.args).toEqual([
      ...CODEX_BASE,
      '--model',
      'gpt-5.5',
      '-c',
      'model_reasoning_effort=low',
      ...CODEX_ROOM_TURN_FLAGS
    ])
  })

  it('adds live web search after the isolation flags on a Codex research room turn', () => {
    const result = planCommitMessageGeneration(
      { agentId: 'codex', model: 'gpt-5.5', roomTurn: true, webResearch: true },
      'PROMPT'
    )

    if (!result.ok) {
      throw new Error('plan failed')
    }
    expect(result.plan.args).toEqual([
      ...CODEX_BASE,
      '--model',
      'gpt-5.5',
      ...CODEX_ROOM_TURN_FLAGS,
      '-c',
      'web_search="live"'
    ])
    expect(result.plan.webResearch).toBe(true)
  })

  it('gives a Codex room code question no code read mode, but keeps the isolation flags', () => {
    const asked = planCommitMessageGeneration(
      { agentId: 'codex', model: 'gpt-5.5', roomTurn: true, codeRead: true },
      'PROMPT'
    )
    const plain = planCommitMessageGeneration(
      { agentId: 'codex', model: 'gpt-5.5', roomTurn: true },
      'PROMPT'
    )

    if (!asked.ok || !plain.ok) {
      throw new Error('plan failed')
    }
    expect(asked.plan.args).toEqual(plain.plan.args)
    expect(asked.plan.codeRead).toBeUndefined()
  })

  it('keeps Codex commit-message generation exactly as it was, without the room flags', () => {
    const result = planCommitMessageGeneration({ agentId: 'codex', model: 'gpt-5.5' }, 'PROMPT')

    if (!result.ok) {
      throw new Error('plan failed')
    }
    expect(result.plan.args).toEqual([...CODEX_BASE, '--model', 'gpt-5.5'])
    expect(result.plan.args).not.toContain('--ignore-user-config')
  })

  it('leaves the other agents room turns unchanged', () => {
    for (const agentId of ['claude', 'antigravity'] as const) {
      const room = planCommitMessageGeneration(
        { agentId, model: 'sonnet', roomTurn: true },
        'PROMPT'
      )
      const plain = planCommitMessageGeneration({ agentId, model: 'sonnet' }, 'PROMPT')
      if (!room.ok || !plain.ok) {
        throw new Error('plan failed')
      }
      expect(room.plan.args).toEqual(plain.plan.args)
    }
  })
})
