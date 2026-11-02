import { describe, expect, it } from 'vitest'
import type { PrototypeSystemCard } from './prototype-design-system-card'
import {
  defaultDelegationDesignSystemMode,
  delegationCountDefault,
  delegationDesignSystemModes
} from './delegation-prototype-choices'

const COUNT = { choices: [1, 2, 3], defaultCount: 2 }

describe('delegationCountDefault', () => {
  it("highlights the viewer's own Settings count over the host's", () => {
    expect(delegationCountDefault(COUNT, 3)).toBe(3)
  })

  it('keeps the host count when the viewer has none, or one the card does not offer', () => {
    expect(delegationCountDefault(COUNT)).toBe(2)
    expect(delegationCountDefault(COUNT, 4)).toBe(2)
  })
})

describe('delegation design system choices', () => {
  const existing: PrototypeSystemCard = {
    kind: 'existing',
    projectKey: 'p',
    projectName: 'P',
    version: 1,
    tokenCount: 3,
    sourceNames: [],
    swatches: []
  }
  const none: PrototypeSystemCard = { kind: 'none', projectKey: 'p', projectName: 'P' }

  it('offers Use it for an existing system and Propose or Skip for none', () => {
    expect(delegationDesignSystemModes(existing)).toEqual(['use'])
    expect(delegationDesignSystemModes(none)).toEqual(['propose', 'skip'])
  })

  it('highlights the first choice the card offers', () => {
    expect(defaultDelegationDesignSystemMode(existing)).toBe('use')
    expect(defaultDelegationDesignSystemMode(none)).toBe('propose')
  })
})
