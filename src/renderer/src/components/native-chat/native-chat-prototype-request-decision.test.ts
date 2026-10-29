import { describe, expect, it } from 'vitest'
import type { PrototypeAgent } from '../../../../shared/prototype-request'
import type { PrototypeCountSetting } from '../../../../shared/prototype-count-setting'
import { decideNativeChatPrototypeRequest } from './native-chat-prototype-request-decision'

const ALWAYS_3: PrototypeCountSetting = { mode: 'always', count: 3 }
const ASK: PrototypeCountSetting = { mode: 'ask', count: 2 }

function decide(text: string, setting: PrototypeCountSetting, agent: PrototypeAgent = 'codex') {
  return decideNativeChatPrototypeRequest({ text, agent, setting })
}

describe('decideNativeChatPrototypeRequest', () => {
  it.each([ALWAYS_3, ASK])('sends a message that asks for nothing as typed (%j)', (setting) => {
    expect(decide('Fix the failing build', setting)).toEqual({ kind: 'as-typed' })
  })

  it('applies the setting at once to a command under "Always make"', () => {
    expect(decide('/prototype a login page', ALWAYS_3)).toEqual({ kind: 'create', count: 3 })
    expect(decide('/prototipo a login page', ALWAYS_3)).toEqual({ kind: 'create', count: 3 })
    expect(decide('/design a login page', ALWAYS_3, 'claude')).toEqual({
      kind: 'create',
      count: 3
    })
  })

  it('asks for a command under "Ask each time", without the "Not a prototype" button', () => {
    expect(decide('/prototype a login page', ASK)).toEqual({ kind: 'ask', keyword: false })
  })

  it.each([ALWAYS_3, ASK])('asks for a keyword match under any mode (%j)', (setting) => {
    expect(decide('Make a mockup of the pricing page', setting)).toEqual({
      kind: 'ask',
      keyword: true
    })
  })

  it('creates the request with the count the card answered', () => {
    expect(
      decideNativeChatPrototypeRequest({
        text: 'Make a mockup of the pricing page',
        agent: 'codex',
        setting: ASK,
        choice: { count: 1 }
      })
    ).toEqual({ kind: 'create', count: 1 })
  })

  it('sends as typed when the card answered "Not a prototype"', () => {
    expect(
      decideNativeChatPrototypeRequest({
        text: 'Make a mockup of the pricing page',
        agent: 'codex',
        setting: ASK,
        choice: 'as-typed'
      })
    ).toEqual({ kind: 'as-typed' })
  })

  it('never builds a request for text that asks for none, whatever was answered', () => {
    expect(
      decideNativeChatPrototypeRequest({
        text: 'Fix the build',
        agent: 'codex',
        setting: ASK,
        choice: { count: 2 }
      })
    ).toEqual({ kind: 'as-typed' })
  })
})
