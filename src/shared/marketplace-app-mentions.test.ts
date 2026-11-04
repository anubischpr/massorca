import { describe, expect, it } from 'vitest'
import {
  marketplaceAppPromptLines,
  marketplaceAppsUsableByTeam,
  mentionedMarketplaceApps,
  withMarketplaceAppPromptLines
} from './marketplace-app-mentions'
import { everyoneAccessPolicy, type MarketplaceAppAccessPolicy } from './marketplace-apps'

const ONLY_BOB: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: ['bob'], teamIds: [] }
}
const NOBODY: MarketplaceAppAccessPolicy = {
  ...everyoneAccessPolicy(),
  bots: { mode: 'only', botIds: [], teamIds: [] }
}

describe('marketplace app mentions', () => {
  it('finds each app a message names with @, once, ignoring case', () => {
    expect(mentionedMarketplaceApps('@Nora check @openmetadata and @Engram, then @engram')).toEqual(
      ['engram', 'openmetadata']
    )
  })

  it('leaves an address, a longer word and a bare name alone', () => {
    expect(mentionedMarketplaceApps('mail me@GitHub.com about @GitHubber and Engram')).toEqual([])
  })

  it('tells the agent to use each app: MCP for Engram and OpenMetadata, gh for GitHub', () => {
    expect(marketplaceAppPromptLines(['engram', 'openmetadata', 'github'])).toEqual([
      'Use the Engram tools (MCP server engram) for this request.',
      'Use the OpenMetadata tools (MCP server openmetadata) for this request.',
      'Use GitHub (the gh command) for this request.'
    ])
  })

  it('adds the lines after the prompt only when the request names an app', () => {
    expect(withMarketplaceAppPromptLines('Prompt', 'Ask @Engram')).toBe(
      'Prompt\n\nUse the Engram tools (MCP server engram) for this request.'
    )
    expect(withMarketplaceAppPromptLines('Prompt', 'No apps here')).toBe('Prompt')
  })

  it('skips the lines of an app the target bot is kept out of', () => {
    expect(withMarketplaceAppPromptLines('Prompt', 'Ask @Engram', ['engram'])).toBe('Prompt')
    expect(withMarketplaceAppPromptLines('Prompt', 'Ask @Engram and @GitHub', ['engram'])).toBe(
      'Prompt\n\nUse GitHub (the gh command) for this request.'
    )
    expect(marketplaceAppPromptLines(['engram', 'github'], ['github'])).toEqual([
      'Use the Engram tools (MCP server engram) for this request.'
    ])
  })
})

describe('marketplaceAppsUsableByTeam', () => {
  const team = { id: 't1', bots: [{ id: 'ann' }, { id: 'bob' }] }

  it('keeps an app at least one bot of the team may use', () => {
    const apps = [{ id: 'engram' as const, access: ONLY_BOB }]
    expect(marketplaceAppsUsableByTeam(apps, team)).toEqual(apps)
  })

  it('hides an app every bot of the team is kept out of', () => {
    const apps = [
      { id: 'engram' as const, access: NOBODY },
      { id: 'openmetadata' as const, access: ONLY_BOB },
      { id: 'github' as const }
    ]
    expect(marketplaceAppsUsableByTeam(apps, team).map((app) => app.id)).toEqual([
      'openmetadata',
      'github'
    ])
  })

  it('keeps every app for a team with no bots or an app with no policy', () => {
    const apps = [{ id: 'engram' as const, access: NOBODY }]
    expect(marketplaceAppsUsableByTeam(apps, { id: 't1', bots: [] })).toEqual(apps)
    expect(marketplaceAppsUsableByTeam([{ id: 'engram' as const }], team)).toHaveLength(1)
  })
})
