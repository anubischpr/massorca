import { describe, expect, it } from 'vitest'
import {
  readMarketplaceActionAnswer,
  readMarketplaceAppsListAnswer
} from './marketplace-apps-params'

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

describe('readMarketplaceAppsListAnswer outside-home flag', () => {
  const listWith = (agent: Record<string, unknown>): unknown => ({
    ok: true,
    apps: [
      {
        id: 'openmetadata',
        connected: true,
        agents: [{ agent: 'codex', level: 'full', entry: 'missing', ...agent }]
      }
    ]
  })

  it('keeps outsideHome on the agent row it belongs to', () => {
    const result = readMarketplaceAppsListAnswer(listWith({ outsideHome: true }))
    if (!result.ok) {
      throw new Error('the list was rejected')
    }
    expect(result.apps[0]?.agents[0]?.outsideHome).toBe(true)
  })

  it('still parses a list from a peer that never sends the flag', () => {
    expect(readMarketplaceAppsListAnswer(listWith({})).ok).toBe(true)
  })

  it('reads a malformed flag as absent instead of failing the whole list', () => {
    const result = readMarketplaceAppsListAnswer(listWith({ outsideHome: 'yes' }))
    if (!result.ok) {
      throw new Error('the list was rejected')
    }
    expect(result.apps[0]?.agents[0]?.outsideHome).toBeUndefined()
  })

  it('drops fields a newer peer adds and keeps the rest of the row', () => {
    const result = readMarketplaceAppsListAnswer(listWith({ outsideHome: true, futureNote: 'x' }))
    if (!result.ok) {
      throw new Error('the list was rejected')
    }
    expect(result.apps[0]?.agents[0]).toEqual({
      agent: 'codex',
      level: 'full',
      entry: 'missing',
      outsideHome: true
    })
  })
})
