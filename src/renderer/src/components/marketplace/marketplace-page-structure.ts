import type { MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import type { CatalogRow, CatalogRowTarget } from './MarketplaceCatalogRows'
import type { MarketplacePageKind } from './marketplace-row-page-resolver'

/** What a Marketplace page renders today. Conditional flags state their condition in a comment. */
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
  sections: { banner: boolean; connection: boolean; advanced: boolean; danger: boolean }
}

const NO_SECTIONS: MarketplacePageStructure['sections'] = {
  banner: false,
  connection: false,
  advanced: false,
  danger: false
}

/** Per page kind, the structure the page renders in its standard state; see the test for each condition. */
export const MARKETPLACE_PAGE_STRUCTURE: Record<MarketplacePageKind, MarketplacePageStructure> = {
  agent: {
    hostPicker: true,
    // Only when the picked host lacks the agent: an Install link here, a disabled one elsewhere.
    install: true,
    uninstall: false,
    connectionConfig: false,
    // "Use this agent" On/Off, which is per host.
    accessPolicy: true,
    sections: NO_SECTIONS
  },
  integration: {
    hostPicker: true,
    // Connect in the header when not connected; Add workspace access once connected.
    install: true,
    // Disconnect in the Danger zone, only while connected (the test renders a connected Linear).
    uninstall: true,
    connectionConfig: true,
    accessPolicy: false,
    // Advanced and Danger are Linear and Jira only; GitLab, Bitbucket, Azure DevOps and Gitea
    // have no Advanced section, and their Danger zone shows only while a token is stored.
    sections: { banner: true, connection: true, advanced: true, danger: true }
  },
  'built-in': {
    hostPicker: false,
    install: false,
    uninstall: false,
    connectionConfig: false,
    accessPolicy: false,
    sections: NO_SECTIONS
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
    // Danger zone only once a copy is on the host.
    sections: { ...NO_SECTIONS, danger: true }
  },
  'item-app': {
    hostPicker: true,
    // Connect in the header while not connected or while an installed agent lacks its entry (the test renders the latter).
    install: true,
    // Disconnect in the Danger zone; a picked remote GitHub page shows only its gh state instead.
    uninstall: true,
    connectionConfig: true,
    accessPolicy: true,
    sections: { banner: true, connection: true, advanced: true, danger: true }
  },
  'item-detail': {
    hostPicker: true,
    // Only while Git is missing on this computer: the Install board.
    install: true,
    uninstall: false,
    connectionConfig: false,
    accessPolicy: false,
    sections: NO_SECTIONS
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
  if (row.target !== null) {
    return sourceOfTarget(row.target)
  }
  if (row.customId !== null) {
    return external([DEPENDENCY.customArgv])
  }
  // Why: the GitHub CLI board row carries the host's gh check; the other board rows have no state behind them.
  if (row.key === 'board-gh') {
    return external([DEPENDENCY.ghAuth])
  }
  // Why: a board skill shows Install or its pending check from the skill scan, so the scan decides it.
  if (row.section === 'skills' && row.key.startsWith('board-')) {
    return external([DEPENDENCY.skillRoot])
  }
  return NATIVE
}

function sourceOfTarget(target: CatalogRowTarget): MarketplaceRowSource {
  switch (target.kind) {
    case 'item':
      return itemSource(target.id)
    case 'agent':
      return external([DEPENDENCY.agentBinary])
    case 'skill':
      return external([DEPENDENCY.skillRoot])
    case 'custom-skill':
      return external([DEPENDENCY.customArgv])
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
