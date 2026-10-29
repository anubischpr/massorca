import { describe, expect, it } from 'vitest'
import { mobilePrototypeAgentFor, mobilePrototypeAgentName } from './mobile-prototype-agent'

describe('mobilePrototypeAgentFor', () => {
  it.each(['claude', 'codex', 'antigravity'])('names %s as itself', (agent) => {
    expect(mobilePrototypeAgentFor(agent, undefined)).toBe(agent)
  })

  it('names a Pi chat on Gentle Shell as gentle-shell, and stock Pi as other', () => {
    expect(mobilePrototypeAgentFor('pi', 'gentle-shell')).toBe('gentle-shell')
    expect(mobilePrototypeAgentFor('pi', 'pi')).toBe('other')
    expect(mobilePrototypeAgentFor('pi', undefined)).toBe('other')
  })

  it('names any other agent as other', () => {
    expect(mobilePrototypeAgentFor('opencode', undefined)).toBe('other')
    expect(mobilePrototypeAgentFor(null, undefined)).toBe('other')
  })
})

describe('mobilePrototypeAgentName', () => {
  it('names the agent the card speaks for', () => {
    expect(mobilePrototypeAgentName('codex', undefined)).toBe('Codex')
    expect(mobilePrototypeAgentName('pi', 'gentle-shell')).toBe('Gentle Shell')
  })
})
