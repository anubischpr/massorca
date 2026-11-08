/** Tools, agents and skills the person adds to the Marketplace by hand ("Add custom" board). */
export type MarketplaceCustomKind = 'tool' | 'agent' | 'skill'

export type MarketplaceCustomPlatform = 'win32' | 'darwin' | 'linux'

export type MarketplaceCustomItem = {
  id: string
  kind: MarketplaceCustomKind
  name: string
  /** argv run on the host to tell whether it is installed; null for skills. Never a shell string. */
  checkCommand: readonly string[] | null
  /** argv per platform; a platform left out means the app does not run there. */
  install: Partial<Record<MarketplaceCustomPlatform, readonly string[]>>
  /** Skills only: the link the skill is installed from. */
  skillUrl?: string
  createdAt: number
}

export type MarketplaceCustomItemStatus = MarketplaceCustomItem & {
  presence: 'found' | 'missing' | 'unverifiable'
  installedBy?: 'massorca' | 'outside'
}

export type MarketplaceCustomAddArgs = {
  kind: MarketplaceCustomKind
  name: string
  /** As typed by the person; parsed into argv on the host, never run through a shell. */
  checkCommand?: string
  install?: Partial<Record<MarketplaceCustomPlatform, string>>
  skillUrl?: string
}

export type MarketplaceCustomResult =
  | { ok: true; item: MarketplaceCustomItemStatus }
  | { ok: false; reason: 'invalid-input' | 'duplicate' | 'not-found' | 'unsupported-platform' | 'failed' }

export type MarketplaceCustomInstallEvent = {
  id: string
  status: 'running' | 'done' | 'failed'
  logLine?: string
}

export type MarketplaceCustomApi = {
  list: () => Promise<MarketplaceCustomItemStatus[]>
  add: (args: MarketplaceCustomAddArgs) => Promise<MarketplaceCustomResult>
  remove: (args: { id: string }) => Promise<MarketplaceCustomResult>
  install: (args: { id: string }) => Promise<MarketplaceCustomResult>
  onInstallEvent: (callback: (event: MarketplaceCustomInstallEvent) => void) => () => void
}
