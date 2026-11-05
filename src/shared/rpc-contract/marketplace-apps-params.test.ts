import { describe, expect, it } from 'vitest'
import { readMarketplaceActionAnswer } from './marketplace-apps-params'

describe('readMarketplaceActionAnswer failure reasons', () => {
  it('keeps outside-home and the agent it belongs to', () => {
    expect(
      readMarketplaceActionAnswer({ ok: false, reason: 'outside-home', agent: 'antigravity' })
    ).toEqual({ ok: false, reason: 'outside-home', agent: 'antigravity' })
  })

  it('reads a reason this build does not know as the generic failure instead of throwing', () => {
    // Why: an older client meets outside-home this way, and a newer host may send reasons not yet here.
    expect(
      readMarketplaceActionAnswer({ ok: false, reason: 'some-future-reason', agent: 'claude' })
    ).toEqual({ ok: false, reason: 'failed' })
  })
})
