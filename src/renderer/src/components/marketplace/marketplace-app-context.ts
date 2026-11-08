import type {
  MarketplaceAppId,
  MarketplaceAppStatus,
  OpenMetadataProfile
} from '../../../../shared/marketplace-apps'
import type { MarketplaceAppInfo } from './marketplace-app-info'
import type {
  MarketplaceActionOutcome,
  MarketplacePerform,
  RunMarketplaceAction
} from './use-marketplace-app-action'
import type { GitHubAccounts } from './use-github-accounts'
import type { MarketplacePreflight } from './use-marketplace-preflight'

/** A dialog the app page can open; each carries what it needs to start. */
export type MarketplaceAppDialog =
  | { kind: 'openmetadata-connect' }
  | { kind: 'openmetadata-token' }
  | { kind: 'openmetadata-profile'; profile: OpenMetadataProfile | null }
  | { kind: 'engram-server' }
  | { kind: 'disconnect' }

/** What the sections of one standard app page read and do. */
export type MarketplaceAppContext = {
  appId: MarketplaceAppId
  /** False until the Marketplace status is known; the page then shows no connection state. */
  ready: boolean
  status: MarketplaceAppStatus
  /** The picked host's name when the page configures a host other than this computer. */
  hostLabel: string | null
  info: MarketplaceAppInfo
  preflight: MarketplacePreflight
  github: GitHubAccounts
  canConnect: boolean
  connectBlocked: boolean
  connect: () => void
  openDialog: (dialog: MarketplaceAppDialog) => void
  /** Runs a change for a dialog, which reports its own failure. */
  run: RunMarketplaceAction
  /** Runs a change from the page; a failure shows above the sections. */
  runInline: (perform: MarketplacePerform) => Promise<MarketplaceActionOutcome>
}
