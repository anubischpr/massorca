import { describe, expect, it } from 'vitest'
import type { PrototypeAgent } from './prototype-request'
import type { PrototypeCountSetting } from './prototype-count-setting'
import {
  decideDelegatedTaskPrototypeCount,
  decideNativeChatPrototypeRequest,
  delegatedTaskAsksForPrototypes
} from './prototype-request-decision'

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

  it.each([
    'Crea una sesión hija que diseñe la pantalla de ajustes',
    'Usa un subagente para diseñar el login',
    'Delegate the login design to a new session'
  ])('sends a hand-off to a child session as typed, with no card (%s)', (text) => {
    expect(decide(text, ALWAYS_3)).toEqual({ kind: 'as-typed' })
    expect(decide(text, ASK)).toEqual({ kind: 'as-typed' })
  })

  it('keeps an explicit command a request, even when it names a child session', () => {
    const text = '/prototype haz el login en una sesión hija'
    expect(decide(text, ALWAYS_3)).toEqual({ kind: 'create', count: 3 })
    expect(decide(text, ASK)).toEqual({ kind: 'ask', keyword: false })
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

describe('decideDelegatedTaskPrototypeCount', () => {
  const decideTask = (
    text: string,
    setting: PrototypeCountSetting,
    agents: PrototypeAgent[] = ['codex']
  ) => decideDelegatedTaskPrototypeCount({ text, agents, setting })

  it('asks the count for a keyword task, with the Settings count as the default', () => {
    const text = 'Make a prototype of the onboarding screen'
    expect(decideTask(text, ASK)).toEqual({ kind: 'ask', defaultCount: 2 })
    expect(decideTask(text, ALWAYS_3)).toEqual({ kind: 'ask', defaultCount: 3 })
  })

  it('does not take the hand-off exemption, since the child is the hand-off', () => {
    const text = 'Haz un prototipo de la pantalla de login en una sesión hija'
    expect(decideNativeChatPrototypeRequest({ text, agent: 'codex', setting: ASK })).toEqual({
      kind: 'as-typed'
    })
    expect(decideTask(text, ASK)).toEqual({ kind: 'ask', defaultCount: 2 })
  })

  it('asks a room worker the count even when the message hands the design to a child session', () => {
    for (const text of [
      'en una sesión hija crea un nuevo diseño para la página "clinical-report"',
      'en una sesión hija crea un nuevo diseño para la página "pipeline-activo"'
    ]) {
      expect(decideNativeChatPrototypeRequest({ text, agent: 'codex', setting: ASK })).toEqual({
        kind: 'as-typed'
      })
      expect(
        decideNativeChatPrototypeRequest({
          text,
          agent: 'codex',
          setting: ASK,
          handOffExempt: false
        })
      ).toEqual({ kind: 'ask', keyword: true })
    }
  })

  it('shows no count question for a command under "Always make", which takes the Settings count', () => {
    expect(decideTask('/prototype a login page', ALWAYS_3)).toEqual({ kind: 'none' })
    expect(decideTask('/prototype a login page', ASK)).toEqual({ kind: 'ask', defaultCount: 2 })
  })

  it('shows no count question for a task that asks for no prototype', () => {
    expect(decideTask('Fix the failing build', ASK)).toEqual({ kind: 'none' })
  })

  it('reads a native command of any offered agent, since the card is shown before the pick', () => {
    const agents: PrototypeAgent[] = ['codex', 'claude']
    expect(decideTask('/design a login page', ASK, agents)).toEqual({
      kind: 'ask',
      defaultCount: 2
    })
    expect(decideTask('/design a login page', ALWAYS_3, agents)).toEqual({ kind: 'none' })
  })
})

describe('delegatedTaskAsksForPrototypes', () => {
  const asks = (text: string, agents: PrototypeAgent[] = ['codex']) =>
    delegatedTaskAsksForPrototypes({ text, agents })

  it('is true for a command, which asks no count under "Always make"', () => {
    expect(asks('/prototype a login page')).toBe(true)
  })

  it('is true for a keyword match', () => {
    expect(asks('Make a prototype of the onboarding screen')).toBe(true)
  })

  it('is false for a task that asks for no prototype', () => {
    expect(asks('Fix the failing build')).toBe(false)
  })
})

describe('a delegated task whose wording is no prototype request', () => {
  // What a parent agent wrote for its child: "information architecture" is a negative term of the composer's
  // lexicon, so the task text alone is never a prototype request.
  const AGENT_TASK =
    'Create a NEW UI design for the pipeline page. Study the information architecture first, then write 2 to 3 HTML artboards.'
  const USER_MESSAGE =
    'Explora el proyecto con sub agentes. Por último, en una sesión hija crea un nuevo diseño para la página "clinical-report"'

  it('is none by its own words, which is the defect the user message covers', () => {
    expect(delegatedTaskAsksForPrototypes({ text: AGENT_TASK, agents: ['codex'] })).toBe(false)
  })

  it('is a prototype task when the person asked for the design in a child session', () => {
    expect(
      delegatedTaskAsksForPrototypes({
        text: AGENT_TASK,
        agents: ['codex'],
        userMessage: USER_MESSAGE
      })
    ).toBe(true)
    expect(
      decideDelegatedTaskPrototypeCount({
        text: AGENT_TASK,
        agents: ['codex'],
        setting: ASK,
        userMessage: USER_MESSAGE
      })
    ).toEqual({ kind: 'ask', defaultCount: 2 })
  })

  it('stays no prototype task when the person asked for no design, or kept it in the chat', () => {
    const noDesign = 'Explora el proyecto con sub agentes y resume los hallazgos'
    const designHere = 'Crea un nuevo diseño para la página "clinical-report"'
    for (const userMessage of [noDesign, designHere]) {
      expect(
        delegatedTaskAsksForPrototypes({ text: AGENT_TASK, agents: ['codex'], userMessage })
      ).toBe(false)
    }
  })
})

describe('a delegated task when the person asked for an artifact', () => {
  const USER_MESSAGE =
    'En NexusCare explora la documentación y crea un artifact interactivo donde pueda visualizarse el impacto probable de estas mejoras'
  // What a lead bot wrote for a teammate: "rediseño" reads as a design keyword.
  const AGENT_TASK =
    'Haz un rediseño visual de la pantalla de liquidaciones con el impacto de las mejoras'

  it('is no prototype task: the agent wording does not turn an artifact into prototypes', () => {
    expect(
      delegatedTaskAsksForPrototypes({
        text: AGENT_TASK,
        agents: ['codex'],
        userMessage: USER_MESSAGE
      })
    ).toBe(false)
    expect(
      decideDelegatedTaskPrototypeCount({
        text: AGENT_TASK,
        agents: ['codex'],
        setting: ASK,
        userMessage: USER_MESSAGE
      })
    ).toEqual({ kind: 'none' })
  })

  it('still follows an explicit prototype command in the task', () => {
    expect(
      delegatedTaskAsksForPrototypes({
        text: '/prototype the settlements screen',
        agents: ['codex'],
        userMessage: USER_MESSAGE
      })
    ).toBe(true)
  })
})
