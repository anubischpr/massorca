import type { MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import type { CatalogRow, CatalogRowTarget } from './MarketplaceCatalogRows'
import type { MarketplacePageKind } from './marketplace-row-page-resolver'

/**
 * What a Marketplace page renders. A flag is true while its control or section is on the page; a
 * function that cannot exist for the page shows a why line instead, so its flag is false there.
 */
export type MarketplacePageStructure = {
  /** The host picker row (MarketplaceHomeHostPicker) sits above the page. */
  hostPicker: boolean
  /** An install or connect action for the picked host. */
  install: boolean
  /** An uninstall, remove or disconnect action. */
  uninstall: boolean
  /** Configuring the connection or account: a button inside the Connection section. */
  connectionConfig: boolean
  /** A "who can use it" control: agent use, per-agent switches, bot teams or an access policy. */
  accessPolicy: boolean
  /** The section is on the page, with its content or with a why line in place of it. */
  sections: { banner: boolean; connection: boolean; advanced: boolean; danger: boolean }
}

const ALL_SECTIONS: MarketplacePageStructure['sections'] = {
  banner: true,
  connection: true,
  advanced: true,
  danger: true
}

// Why: Linear and Jira share one shape; they connect through the account scope, so the picked host is never theirs.
const LINEAR_LIKE: MarketplacePageStructure = {
  hostPicker: true,
  // Connect in the header while not connected; Add workspace access once connected.
  install: true,
  // Disconnect in the Danger zone, only while connected.
  uninstall: true,
  // Add workspace access in the Connection section, only while connected.
  connectionConfig: true,
  // Per-agent limits are not backed for integrations yet; Advanced options says so.
  accessPolicy: false,
  sections: ALL_SECTIONS
}

// Why: GitLab, Bitbucket, Azure DevOps and Gitea share one shape; each saves its token on the picked host.
const SERVICE_LIKE: MarketplacePageStructure = {
  hostPicker: true,
  // Connect in the header while no token is saved on the picked host.
  install: true,
  // Disconnect in the Danger zone, only while a token is stored on the picked host.
  uninstall: true,
  // Connect, or Replace, in the Connection section.
  connectionConfig: true,
  // Per-agent limits are not backed for integrations yet; Advanced options says so.
  accessPolicy: false,
  sections: ALL_SECTIONS
}

/** Per page kind, the structure the page renders; the render test checks each state its comments name. */
export const MARKETPLACE_PAGE_STRUCTURE: Record<MarketplacePageKind, MarketplacePageStructure> = {
  agent: {
    hostPicker: true,
    // Only when the picked host lacks the agent: an Install link here, a disabled one elsewhere.
    install: true,
    // Agents are installed by their vendor, so MassOrca has nothing to uninstall.
    uninstall: false,
    connectionConfig: false,
    // "Use this agent" On/Off, which is per host.
    accessPolicy: true,
    sections: ALL_SECTIONS
  },
  'integration:linear': LINEAR_LIKE,
  'integration:jira': LINEAR_LIKE,
  'integration:gitlab': SERVICE_LIKE,
  'integration:bitbucket': SERVICE_LIKE,
  'integration:azure-devops': SERVICE_LIKE,
  'integration:gitea': SERVICE_LIKE,
  'built-in': {
    hostPicker: true,
    // Built into this version of MassOrca, so nothing installs or removes it.
    install: false,
    uninstall: false,
    connectionConfig: false,
    accessPolicy: false,
    sections: ALL_SECTIONS
  },
  skill: {
    hostPicker: true,
    // Only while the skill is not installed on the picked host; an installed skill shows Remove.
    install: true,
    // Remove from the host, only once a copy is on it.
    uninstall: true,
    connectionConfig: false,
    // Per-workspace switches and bot teams.
    accessPolicy: true,
    sections: ALL_SECTIONS
  },
  'item-app': {
    hostPicker: true,
    // Connect in the header while not connected or while an installed agent lacks its entry (the test renders the latter).
    install: true,
    // Disconnect in the Danger zone; a picked remote GitHub page shows only its gh state instead.
    uninstall: true,
    connectionConfig: true,
    accessPolicy: true,
    sections: ALL_SECTIONS
  },
  'item-detail': {
    hostPicker: true,
    // Only while Git is missing on this computer: the Install board.
    install: true,
    // MassOrca does not remove Git.
    uninstall: false,
    connectionConfig: false,
    accessPolicy: false,
    sections: ALL_SECTIONS
  },
  'board-tool': {
    hostPicker: true,
    // Neither GitHub CLI nor Node.js has an install MassOrca can run yet.
    install: false,
    uninstall: false,
    connectionConfig: false,
    accessPolicy: false,
    sections: ALL_SECTIONS
  },
  'custom-item': {
    hostPicker: true,
    // Only while the item is missing on this computer; its install command runs here.
    install: true,
    // Remove from the Marketplace list, only on this computer.
    uninstall: true,
    connectionConfig: false,
    accessPolicy: false,
    sections: ALL_SECTIONS
  },
  'custom-unavailable': {
    hostPicker: true,
    // Custom items are checked on this computer only; the picked host has no check for them yet.
    install: false,
    uninstall: false,
    connectionConfig: false,
    accessPolicy: false,
    sections: ALL_SECTIONS
  }
}

export type MarketplaceRowSource =
  | { source: 'native' }
  | { source: 'external'; externalDependencies: string[] }

const NATIVE: MarketplaceRowSource = { source: 'native' }

const DEPENDENCY = {
  ghAuth: 'GitHub CLI signed in with gh auth login',
  engramCli: 'Engram CLI on PATH',
  engramDataDir: 'ENGRAM_DATA_DIR',
  agentMcpConfig: 'Agent MCP config files, read by entry name',
  openMetadata: 'OpenMetadata server and profiles',
  settingsIntegration: 'Settings-store integration checks',
  remoteAccountScope: 'Account scope under Remote Servers',
  glab: 'glab CLI installed outside MassOrca',
  agentBinary: 'Agent binary detected on the host PATH, installed from the vendor homepage',
  skillRoot: 'Any folder in an agent skill root on the host',
  customArgv: 'Check command (argv) the user wrote'
} as const

function external(externalDependencies: string[]): MarketplaceRowSource {
  return { source: 'external', externalDependencies }
}

/** Native when the Marketplace holds the row's state; external when another store or tool decides it. */
export function marketplaceRowSource(row: CatalogRow): MarketplaceRowSource {
  return row.target === null ? NATIVE : sourceOfTarget(row.target)
}

function sourceOfTarget(target: CatalogRowTarget): MarketplaceRowSource {
  switch (target.kind) {
    case 'item':
      return itemSource(target.id)
    case 'agent':
      return external([DEPENDENCY.agentBinary])
    case 'skill':
      return external([DEPENDENCY.skillRoot])
    // Why: a board skill shows Install or its pending check from the skill scan, so the scan decides it.
    case 'board-skill':
      return external([DEPENDENCY.skillRoot])
    case 'custom-skill':
    case 'custom-item':
      return external([DEPENDENCY.customArgv])
    case 'custom-unavailable':
      return NATIVE
    // Why: the GitHub CLI row carries the host's gh check; Node.js has no state behind it.
    case 'board-tool':
      return target.id === 'gh' ? external([DEPENDENCY.ghAuth]) : NATIVE
    case 'built-in':
      return NATIVE
    case 'integration':
      return integrationSource(target.id)
  }
}

function itemSource(id: MarketplaceItemId): MarketplaceRowSource {
  switch (id) {
    case 'git':
      return NATIVE
    case 'engram':
      return external([DEPENDENCY.engramCli, DEPENDENCY.engramDataDir, DEPENDENCY.agentMcpConfig])
    case 'github':
      return external([DEPENDENCY.ghAuth])
    case 'openmetadata':
      return external([DEPENDENCY.openMetadata])
  }
}

function integrationSource(id: MarketplaceIntegrationId): MarketplaceRowSource {
  switch (id) {
    case 'gitlab':
      return external([DEPENDENCY.settingsIntegration, DEPENDENCY.glab])
    case 'bitbucket':
    case 'azure-devops':
    case 'gitea':
      return external([DEPENDENCY.settingsIntegration])
    case 'linear':
    case 'jira':
      return external([DEPENDENCY.settingsIntegration, DEPENDENCY.remoteAccountScope])
  }
}
