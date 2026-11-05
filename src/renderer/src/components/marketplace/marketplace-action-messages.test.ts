import { describe, expect, it } from 'vitest'
import { marketplaceFailureMessage } from './marketplace-action-messages'
import { marketplaceAgentLabel } from './marketplace-catalog'

describe('marketplaceFailureMessage', () => {
  it('names the agent whose settings file links outside the home', () => {
    const agent = marketplaceAgentLabel('antigravity')
    expect(
      marketplaceFailureMessage({ ok: false, reason: 'outside-home', agent: 'antigravity' })
    ).toBe(`The settings file for ${agent} links outside this home, so MassOrca left it alone.`)
  })

  it('still says something useful when no agent is known', () => {
    expect(marketplaceFailureMessage({ ok: false, reason: 'outside-home' })).toBe(
      'A settings file links outside this home, so MassOrca left it alone.'
    )
  })
})
