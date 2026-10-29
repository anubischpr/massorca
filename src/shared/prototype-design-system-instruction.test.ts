import { describe, expect, it } from 'vitest'
import { DESIGN_SYSTEM_READ_INSTRUCTION } from './prototype-design-system-instruction'
import { buildPrototypeRequestMessage } from './prototype-request'

const MISSING_BRANCH_END = 'write the three files, and stop.'
const REUSE = 'If they exist, reuse them as they are: never regenerate, rewrite or reformat them.'
const ADD_ONLY_WHAT_IS_MISSING =
  'If a direction needs a token or component the system lacks, add only that one, keep every existing token, value and component unchanged, bump the version with a history entry, and note the addition in system.md.'

describe('DESIGN_SYSTEM_READ_INSTRUCTION', () => {
  it.each([REUSE, ADD_ONLY_WHAT_IS_MISSING])('says %j', (sentence) => {
    expect(DESIGN_SYSTEM_READ_INSTRUCTION).toContain(sentence)
  })

  it('reuses an existing system right after the branch that builds a missing one', () => {
    const text = DESIGN_SYSTEM_READ_INSTRUCTION
    expect(text.indexOf(MISSING_BRANCH_END)).toBeLessThan(text.indexOf(REUSE))
    expect(text.indexOf(REUSE)).toBeLessThan(text.indexOf(ADD_ONLY_WHAT_IS_MISSING))
    expect(text.indexOf(ADD_ONLY_WHAT_IS_MISSING)).toBeLessThan(
      text.indexOf('If the project has no identity')
    )
  })
})

describe('a prototype request that uses the design system', () => {
  const request = buildPrototypeRequestMessage({
    text: 'a prototype of a login',
    agent: 'claude',
    count: 2,
    requestId: '20261028-201500-k3f9q2',
    folderPath: '/state/visuals/prototypes/20261028-201500-k3f9q2',
    designSystem: 'use'
  })

  it.each([REUSE, ADD_ONLY_WHAT_IS_MISSING])(
    'sends %j, and the chat never shows it',
    (sentence) => {
      expect(request.sentText).toContain(sentence)
      expect(request.visibleText).not.toContain(sentence)
    }
  )
})
