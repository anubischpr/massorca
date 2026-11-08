import { describe, expect, it } from 'vitest'
import {
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppStatus
} from '../../../../shared/marketplace-apps'
import { connectedMarketplaceAppMentions } from './use-connected-marketplace-apps'

const NOBODY: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: [], teamIds: [] }
}
const ONLY_BOB: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: ['bob'], teamIds: [] }
}
const APPS: MarketplaceAppStatus[] = [
  { id: 'engram', connected: true, agents: [], access: NOBODY },
  { id: 'openmetadata', connected: true, agents: [], access: ONLY_BOB },
  { id: 'github', connected: false, agents: [] }
]
const TEAM = { id: 't1', bots: [{ id: 'ann' }, { id: 'bob' }] }

describe('connectedMarketplaceAppMentions', () => {
  it('offers every connected app outside a room', () => {
    expect(connectedMarketplaceAppMentions(APPS).map((app) => app.id)).toEqual([
      'engram',
      'openmetadata'
    ])
  })

  it('hides an app every bot of the room team is kept out of', () => {
    expect(connectedMarketplaceAppMentions(APPS, TEAM).map((app) => app.id)).toEqual([
      'openmetadata'
    ])
  })
})
