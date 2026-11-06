import type { MarketplaceText } from './marketplace-app-info'

/** The source-control and task connections Settings lists under Integrations; GitHub has its own app page. */
export const MARKETPLACE_INTEGRATION_IDS = [
  'gitlab',
  'bitbucket',
  'azure-devops',
  'gitea',
  'linear',
  'jira'
] as const

export type MarketplaceIntegrationId = (typeof MARKETPLACE_INTEGRATION_IDS)[number]

/** Connections are app-wide, so the state has no host: it is what the active runtime reports. */
export type MarketplaceIntegrationState = 'checking' | 'connected' | 'not-connected' | 'unavailable'

export type MarketplaceIntegrationStates = Record<
  MarketplaceIntegrationId,
  MarketplaceIntegrationState
>

export type MarketplaceIntegrationInfo = {
  name: string
  tagline: MarketplaceText
  /** The catalog row's one line. */
  description: MarketplaceText
  prompts: readonly [MarketplaceText, MarketplaceText, MarketplaceText]
}

const COPY = 'auto.components.marketplace.marketplace-integrations'

export const MARKETPLACE_INTEGRATIONS: Record<
  MarketplaceIntegrationId,
  MarketplaceIntegrationInfo
> = {
  gitlab: {
    name: 'GitLab',
    tagline: {
      key: `${COPY}.gitlabTagline`,
      fallback: 'Merge requests, issues, todos and pipelines, through the glab command.'
    },
    description: {
      key: `${COPY}.gitlabDescription`,
      fallback: 'Merge requests, issues and pipelines.'
    },
    prompts: [
      {
        key: `${COPY}.gitlabPromptOne`,
        fallback: 'Which merge requests are waiting for my review?'
      },
      {
        key: `${COPY}.gitlabPromptTwo`,
        fallback: 'Why did the last pipeline on main fail?'
      },
      {
        key: `${COPY}.gitlabPromptThree`,
        fallback: 'List the issues assigned to me.'
      }
    ]
  },
  bitbucket: {
    name: 'Bitbucket',
    tagline: {
      key: `${COPY}.bitbucketTagline`,
      fallback: 'Pull requests and build statuses for Bitbucket Cloud.'
    },
    description: {
      key: `${COPY}.bitbucketDescription`,
      fallback: 'Pull requests and build statuses.'
    },
    prompts: [
      {
        key: `${COPY}.bitbucketPromptOne`,
        fallback: 'Which pull requests are open on this repository?'
      },
      {
        key: `${COPY}.bitbucketPromptTwo`,
        fallback: 'Did the build pass on my pull request?'
      },
      {
        key: `${COPY}.bitbucketPromptThree`,
        fallback: 'Summarize the review comments on my open pull request.'
      }
    ]
  },
  'azure-devops': {
    name: 'Azure DevOps',
    tagline: {
      key: `${COPY}.azureTagline`,
      fallback: 'Pull requests and build statuses for Azure Repos.'
    },
    description: {
      key: `${COPY}.azureDescription`,
      fallback: 'Pull requests and build statuses for Azure Repos.'
    },
    prompts: [
      {
        key: `${COPY}.azurePromptOne`,
        fallback: 'Which pull requests are waiting for my approval?'
      },
      {
        key: `${COPY}.azurePromptTwo`,
        fallback: 'Is the build green on my pull request?'
      },
      {
        key: `${COPY}.azurePromptThree`,
        fallback: 'What changed in this pull request since my last review?'
      }
    ]
  },
  gitea: {
    name: 'Gitea',
    tagline: {
      key: `${COPY}.giteaTagline`,
      fallback: 'Pull requests and commit statuses through the Gitea API.'
    },
    description: {
      key: `${COPY}.giteaDescription`,
      fallback: 'Pull requests and commit statuses.'
    },
    prompts: [
      {
        key: `${COPY}.giteaPromptOne`,
        fallback: 'Which pull requests are open here?'
      },
      {
        key: `${COPY}.giteaPromptTwo`,
        fallback: 'Did the checks pass on this commit?'
      },
      {
        key: `${COPY}.giteaPromptThree`,
        fallback: 'What is still blocking my pull request from merging?'
      }
    ]
  },
  linear: {
    name: 'Linear',
    tagline: {
      key: `${COPY}.linearTagline`,
      fallback: 'Browse Linear issues and start workspaces with their context.'
    },
    description: {
      key: `${COPY}.linearDescription`,
      fallback: 'Browse and link Linear issues.'
    },
    prompts: [
      {
        key: `${COPY}.linearPromptOne`,
        fallback: 'What Linear issues are assigned to me?'
      },
      {
        key: `${COPY}.linearPromptTwo`,
        fallback: 'Start a workspace for the issue I have open.'
      },
      {
        key: `${COPY}.linearPromptThree`,
        fallback: 'Which issues are blocked this week?'
      }
    ]
  },
  jira: {
    name: 'Jira',
    tagline: {
      key: `${COPY}.jiraTagline`,
      fallback: 'Browse, create and start work from Jira issues.'
    },
    description: {
      key: `${COPY}.jiraDescription`,
      fallback: 'Browse, create and start work from Jira issues.'
    },
    prompts: [
      {
        key: `${COPY}.jiraPromptOne`,
        fallback: 'Which Jira issues are assigned to me?'
      },
      {
        key: `${COPY}.jiraPromptTwo`,
        fallback: 'Start a workspace for the issue I have open.'
      },
      {
        key: `${COPY}.jiraPromptThree`,
        fallback: 'What is in the current sprint?'
      }
    ]
  }
}
