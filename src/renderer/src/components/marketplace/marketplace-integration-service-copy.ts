import { translate } from '@/i18n/i18n'
import type {
  MarketplaceServiceId,
  MarketplaceServiceStatus
} from '../../../../shared/marketplace-services'
import { credentialSummary } from './marketplace-vault-credential-text'
import type { MarketplaceIntegrationState } from './marketplace-integrations'
import type { ServiceHostState } from './marketplace-integration-service-host'

const COPY = 'auto.components.marketplace.MarketplaceIntegrationService'

export type ServiceFields = {
  /** Shown only for Bitbucket: an email turns the token into an Atlassian API token. */
  email: boolean
  address: string
  addressHint: string
  tokenLabel: string
}

export type ServiceCopy = {
  cardName: string
  learnMoreUrl: string
  connectLabel: string
  replaceLabel: string
  dialogTitle: string
  dialogDescription: string
  fields: ServiceFields
}

const LEARN_MORE: Record<MarketplaceServiceId, string> = {
  gitlab: 'https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/auth/login.md',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/using-api-tokens/',
  'azure-devops':
    'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
  gitea: 'https://docs.gitea.com/next/development/api-usage'
}

export const GITLAB_INSTALL_URL = 'https://gitlab.com/gitlab-org/cli#installation'

/** What the Connect dialog asks for, per service. */
export function serviceCopy(service: MarketplaceServiceId, appName: string): ServiceCopy {
  const tokenLabel = translate(`${COPY}.tokenLabel`, 'Access token')
  const base = {
    learnMoreUrl: LEARN_MORE[service],
    connectLabel: translate(`${COPY}.connect`, 'Connect'),
    replaceLabel: translate(`${COPY}.replace`, 'Replace token'),
    dialogTitle: translate(`${COPY}.dialogTitle`, 'Connect {{app}}', { app: appName })
  }
  switch (service) {
    case 'gitlab':
      return {
        ...base,
        cardName: translate(`${COPY}.gitlabCard`, 'GitLab CLI'),
        replaceLabel: translate(`${COPY}.gitlabReplace`, 'Sign in with a token'),
        dialogDescription: translate(
          `${COPY}.gitlabDescription`,
          'Paste a GitLab access token. MassOrca signs the GitLab CLI in with it; the token is not kept by MassOrca.'
        ),
        fields: {
          email: false,
          tokenLabel,
          address: translate(`${COPY}.gitlabAddress`, 'GitLab server (optional)'),
          addressHint: 'https://gitlab.example.com'
        }
      }
    case 'bitbucket':
      return {
        ...base,
        cardName: translate(`${COPY}.bitbucketCard`, 'Bitbucket credential'),
        dialogDescription: translate(
          `${COPY}.bitbucketDescription`,
          'Use an Atlassian API token with your email, or an access token on its own. MassOrca checks it with Bitbucket before saving.'
        ),
        fields: {
          email: true,
          tokenLabel: translate(`${COPY}.bitbucketToken`, 'API token or access token'),
          address: translate(`${COPY}.bitbucketAddress`, 'API address (optional)'),
          addressHint: 'https://api.bitbucket.org/2.0'
        }
      }
    case 'azure-devops':
      return {
        ...base,
        cardName: translate(`${COPY}.tokenCard`, 'API token'),
        dialogDescription: translate(
          `${COPY}.azureDescription`,
          'Paste a personal access token. Add the API address only when MassOrca cannot work it out from the repository.'
        ),
        fields: {
          email: false,
          tokenLabel: translate(`${COPY}.azureToken`, 'Personal access token'),
          address: translate(`${COPY}.azureAddress`, 'Organization or API address (optional)'),
          addressHint: 'https://dev.azure.com/your-organization'
        }
      }
    case 'gitea':
      return {
        ...base,
        cardName: translate(`${COPY}.tokenCard`, 'API token'),
        dialogDescription: translate(
          `${COPY}.giteaDescription`,
          'Public repositories need no token. Paste one for private repositories, and add the server address only when MassOrca cannot work it out from the repository.'
        ),
        fields: {
          email: false,
          tokenLabel,
          address: translate(`${COPY}.giteaAddress`, 'Server address (optional)'),
          addressHint: 'https://gitea.example.com'
        }
      }
  }
}

/** The card's second line: what this host reports, in words that name no variable. */
export function serviceSubtitle(
  service: MarketplaceServiceId,
  state: ServiceHostState,
  hostLabel: string
): string {
  switch (state.kind) {
    case 'loading':
      return translate(`${COPY}.checking`, 'Checking {{host}}…', { host: hostLabel })
    case 'failed':
      return state.message
    case 'not-on-host':
      return notOnHostMessage(state.target.kind)
    case 'ready':
      return readySubtitle(service, state.entry, hostLabel, state.store)
  }
}

export function notOnHostMessage(kind: 'ssh' | 'wsl' | 'runtime'): string {
  return kind === 'wsl'
    ? translate(
        'auto.components.marketplace.MarketplaceAppPage.wslNotAvailable',
        'Not available on WSL yet'
      )
    : translate(`${COPY}.sshNotAvailable`, 'Not available on SSH hosts yet')
}

function readySubtitle(
  service: MarketplaceServiceId,
  entry: MarketplaceServiceStatus,
  hostLabel: string,
  store: 'keychain' | 'key-file'
): string {
  if (entry.source === 'none') {
    if (service === 'gitlab') {
      return entry.cliInstalled === false
        ? translate(`${COPY}.notInstalled`, 'Not installed on {{host}}', { host: hostLabel })
        : translate(`${COPY}.notSignedIn`, 'Not signed in on {{host}}', { host: hostLabel })
    }
    return translate(`${COPY}.notSet`, 'Not set on {{host}}', { host: hostLabel })
  }
  if (entry.source === 'external') {
    return service === 'gitlab'
      ? translate(`${COPY}.signedIn`, 'Signed in on {{host}}', { host: hostLabel })
      : translate(`${COPY}.external`, 'Already set up on {{host}}', { host: hostLabel })
  }
  const saved = credentialSummary({
    ...(entry.updatedAt === undefined ? {} : { updatedAt: entry.updatedAt }),
    location: { hostLabel, store }
  })
  const parts = [entry.account ?? entry.baseUrl, saved].filter(
    (part): part is string => typeof part === 'string' && part.length > 0
  )
  return parts.length > 0 ? parts.join(' · ') : translate(`${COPY}.connected`, 'Connected')
}

/** The page header's state for a service on the picked host. */
export function serviceIntegrationState(state: ServiceHostState): MarketplaceIntegrationState {
  switch (state.kind) {
    case 'loading':
      return 'checking'
    case 'ready':
      return state.entry.source === 'none' ? 'not-connected' : 'connected'
    case 'failed':
    case 'not-on-host':
      return 'unavailable'
  }
}
