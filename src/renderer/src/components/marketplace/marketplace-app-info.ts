import type { MarketplaceAppId } from '../../../../shared/marketplace-apps'

/** A translatable string with its English fallback. */
export type MarketplaceText = { key: string; fallback: string }

export type MarketplaceAppInfo = {
  name: string
  tagline: MarketplaceText
  description: MarketplaceText
  developer: string
  category: MarketplaceText
  /** Full address; the page shows it without the scheme. */
  website: string
  privacyUrl?: string
  termsUrl?: string
  /** Example prompts; each is copied with the app's @ mention. */
  prompts: readonly [MarketplaceText, MarketplaceText, MarketplaceText]
}

export const MARKETPLACE_APP_INFO: Record<MarketplaceAppId, MarketplaceAppInfo> = {
  engram: {
    name: 'Engram',
    tagline: {
      key: 'auto.components.marketplace.marketplace-app-info.engramTagline',
      fallback: 'Memory your agents keep between sessions.'
    },
    description: {
      key: 'auto.components.marketplace.marketplace-app-info.engramDescription',
      fallback: 'Decisions, fixes and conventions, ready when the next session starts.'
    },
    developer: 'Gentleman Programming',
    category: {
      key: 'auto.components.marketplace.marketplace-app-info.memoryCategory',
      fallback: 'Memory'
    },
    website: 'https://github.com/Gentleman-Programming/engram',
    prompts: [
      {
        key: 'auto.components.marketplace.marketplace-app-info.engramPromptOne',
        fallback: 'What did we decide about the release branch last week?'
      },
      {
        key: 'auto.components.marketplace.marketplace-app-info.engramPromptTwo',
        fallback: 'Save this fix so the next session knows about it.'
      },
      {
        key: 'auto.components.marketplace.marketplace-app-info.engramPromptThree',
        fallback: 'Which bugs did we already solve in the sync code?'
      }
    ]
  },
  openmetadata: {
    name: 'OpenMetadata',
    tagline: {
      key: 'auto.components.marketplace.marketplace-app-info.openMetadataTagline',
      fallback: "Your company's context center, as an MCP server for your agents."
    },
    description: {
      key: 'auto.components.marketplace.marketplace-app-info.openMetadataDescription',
      fallback: 'Look up owners, definitions and lineage for the data your agents work with.'
    },
    developer: 'OpenMetadata',
    category: {
      key: 'auto.components.marketplace.marketplace-app-info.dataCategory',
      fallback: 'Data and context'
    },
    website: 'https://open-metadata.org',
    prompts: [
      {
        key: 'auto.components.marketplace.marketplace-app-info.openMetadataPromptOne',
        fallback: 'Where does the revenue dashboard get its numbers?'
      },
      {
        key: 'auto.components.marketplace.marketplace-app-info.openMetadataPromptTwo',
        fallback: 'Who owns the customers table, and what does churn_flag mean?'
      },
      {
        key: 'auto.components.marketplace.marketplace-app-info.openMetadataPromptThree',
        fallback: 'What do we know about the supplier price list?'
      }
    ]
  },
  github: {
    name: 'GitHub',
    tagline: {
      key: 'auto.components.marketplace.marketplace-app-info.githubTagline',
      fallback: 'Pull requests and issues from GitHub, through the gh command.'
    },
    description: {
      key: 'auto.components.marketplace.marketplace-app-info.githubDescription',
      fallback:
        'Pull requests, issues and checks from GitHub, through the GitHub CLI on this computer.'
    },
    developer: 'GitHub',
    category: {
      key: 'auto.components.marketplace.marketplace-app-info.programmingCategory',
      fallback: 'Programming'
    },
    website: 'https://github.com',
    privacyUrl: 'https://docs.github.com/privacy',
    termsUrl: 'https://docs.github.com/terms',
    prompts: [
      {
        key: 'auto.components.marketplace.marketplace-app-info.githubPromptOne',
        fallback: 'Which pull requests are waiting for my review?'
      },
      {
        key: 'auto.components.marketplace.marketplace-app-info.githubPromptTwo',
        fallback: 'Open an issue for the crash we just found, with the steps.'
      },
      {
        key: 'auto.components.marketplace.marketplace-app-info.githubPromptThree',
        fallback: 'What changed in main since yesterday?'
      }
    ]
  }
}

/** The address as people write it: no scheme and no trailing slash. */
export function websiteLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
