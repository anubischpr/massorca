import type { MarketplaceCredentialStore } from './marketplace-apps'
import type { SecretAtRestProtection } from './secret-at-rest-protection'

/** The source-control services the Marketplace connects from its own pages, on any host. */
export const MARKETPLACE_SERVICE_IDS = ['gitlab', 'bitbucket', 'azure-devops', 'gitea'] as const
export type MarketplaceServiceId = (typeof MARKETPLACE_SERVICE_IDS)[number]

/** Saved by MassOrca on that host, set up outside MassOrca, or not set up. */
export type MarketplaceServiceSource = 'stored' | 'external' | 'none'

/** One service as a client may see it: where its sign-in comes from, never a token. */
export type MarketplaceServiceStatus = {
  service: MarketplaceServiceId
  source: MarketplaceServiceSource
  /** Epoch milliseconds of the last save; only for a `stored` sign-in. */
  updatedAt?: number
  account?: string
  baseUrl?: string
  /** GitLab only: whether the GitLab program is on that host. */
  cliInstalled?: boolean
  /** Bitbucket only: how a stored credential sits on disk. */
  credentialProtection?: SecretAtRestProtection | null
}

export type MarketplaceServicesHostStatus = {
  hostLabel: string
  store: MarketplaceCredentialStore
  services: MarketplaceServiceStatus[]
}

export type MarketplaceServicesFailure =
  | 'invalid-input'
  | 'vault-unavailable'
  /** The service refused the credential. `message` is a fixed sentence, never a token. */
  | 'rejected'
  | 'unreachable'
  /** The host predates the service methods, so the client says to update it first. */
  | 'host-needs-update'
  | 'unavailable-on-host'
  | 'failed'

export type MarketplaceServicesResult =
  | { ok: true; status: MarketplaceServicesHostStatus }
  | { ok: false; reason: MarketplaceServicesFailure; message?: string }

/** A token travels from the page to the host once and is never returned. */
export type MarketplaceServiceConnectArgs = {
  service: MarketplaceServiceId
  token: string
  /** The service address when it cannot be derived: Gitea server, Azure DevOps API, a GitLab host. */
  baseUrl?: string
  /** Bitbucket only: with an email the token is an Atlassian API token, without one an access token. */
  email?: string
}

export type MarketplaceServiceDisconnectArgs = { service: MarketplaceServiceId }

/** This computer's services, over IPC; other hosts go through the same calls on their own runtime. */
export type MarketplaceServicesApi = {
  status: () => Promise<MarketplaceServicesResult>
  connect: (args: MarketplaceServiceConnectArgs) => Promise<MarketplaceServicesResult>
  disconnect: (args: MarketplaceServiceDisconnectArgs) => Promise<MarketplaceServicesResult>
}
