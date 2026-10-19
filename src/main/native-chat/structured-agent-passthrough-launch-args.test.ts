import { describe, expect, it } from 'vitest'
import { structuredPassthroughLaunchArgs } from './structured-agent-passthrough-launch-args'
import { argumentProblemOf } from './structured-agent-arguments-error'

const owned = {
  valueFlags: new Set(['--mode', '--session']),
  switches: new Set(['--print', '-p', '--dangerously-skip-permissions'])
}

describe('structuredPassthroughLaunchArgs', () => {
  it('keeps options and their values in order', () => {
    expect(
      structuredPassthroughLaunchArgs(
        'Pi',
        ['--thinking', 'high', '--verbose', '-e', 'a', 'b'],
        owned
      )
    ).toEqual(['--thinking', 'high', '--verbose', '-e', 'a', 'b'])
  })

  it('drops Orca-owned options with their value and keeps what follows', () => {
    expect(
      structuredPassthroughLaunchArgs(
        'Antigravity',
        [
          '--mode',
          'plan',
          '--session=x',
          '--dangerously-skip-permissions',
          '-p',
          '--add-dir',
          '/w'
        ],
        owned
      )
    ).toEqual(['--add-dir', '/w'])
  })

  it('stops at the end-of-options marker', () => {
    expect(structuredPassthroughLaunchArgs('Pi', ['--a', '--', 'hello'], owned)).toEqual(['--a'])
  })

  it.each([
    ['leading prompt', ['hello']],
    ['prompt after an owned switch', ['--print', 'hello']],
    ['second operand of an owned value option', ['--mode', 'plan', 'hello']]
  ])('refuses a positional prompt: %s', (_name, tokens) => {
    try {
      structuredPassthroughLaunchArgs('Pi', tokens, owned)
      expect.unreachable()
    } catch (error) {
      expect(argumentProblemOf(error)).toEqual({
        agent: 'Pi',
        option: 'prompt',
        problem: 'positionalPrompt'
      })
    }
  })
})
