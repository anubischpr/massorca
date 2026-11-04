import { describe, expect, it } from 'vitest'
import {
  marketplaceAppPromptLines,
  mentionedMarketplaceApps,
  withMarketplaceAppPromptLines
} from './marketplace-app-mentions'

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
})
