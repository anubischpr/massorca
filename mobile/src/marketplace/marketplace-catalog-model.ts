import {
  MARKETPLACE_APP_AGENTS,
  type MarketplaceAppAgent,
  type MarketplaceAppStatus
} from '../../../src/shared/marketplace-apps'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import type { MarketplaceGlyphName } from './marketplace-glyphs'
import type { HostToolState } from './marketplace-host-rpc'

export type CatalogKind = 'tool' | 'agent' | 'skill' | 'service'
export type CatalogTabId = 'all' | CatalogKind

/** States the host reports: installed, found, connected, missing (Install), off (Connect). */
export type CatalogState = 'installed' | 'found' | 'connected' | 'missing' | 'off'

export type CatalogActionTone = 'ok' | 'quiet' | 'secondary'

export type CatalogIcon =
  | { kind: 'glyph'; glyph: MarketplaceGlyphName }
  | { kind: 'agent'; agentId: MarketplaceAppAgent }

export type CatalogItem = {
  id: string
  kind: CatalogKind
  name: string
  desc: string
  icon: CatalogIcon
  state: CatalogState
  /** 'host' was read from the host. 'board' rows are not reported by the host and show only the not-yet-set action. */
  source: 'host' | 'board'
  /** Screen a tap on the row opens; null when the board has none. */
  openPath: string | null
  /** Screen the action button opens; null when the phone cannot act on it. */
  actionPath: string | null
}

/** What the host reported. A null field means that read failed, so its host items are left out. */
export type CatalogSource = {
  apps: readonly MarketplaceAppStatus[] | null
  tools: HostToolState | null
  agentIds: ReadonlySet<string> | null
  piRuntimes: readonly PiRuntimeSelection[] | null
}

export const CATALOG_TABS: readonly { id: CatalogTabId; name: string }[] = [
  { id: 'all', name: 'All' },
  { id: 'tool', name: 'Tools' },
  { id: 'agent', name: 'Agents' },
  { id: 'skill', name: 'Skills' },
  { id: 'service', name: 'Services' }
]

const KIND_NAMES: Record<CatalogKind, string> = {
  tool: 'Tools',
  agent: 'Agents',
  skill: 'Skills',
  service: 'Services'
}
const KIND_ORDER: readonly CatalogKind[] = ['tool', 'agent', 'skill', 'service']

const AGENT_COPY: Record<MarketplaceAppAgent, { name: string; desc: string }> = {
  claude: { name: 'Claude Code', desc: 'Coding agent from Anthropic.' },
  codex: { name: 'Codex', desc: 'Coding agent from OpenAI.' },
  antigravity: { name: 'Antigravity', desc: 'Coding agent from Google.' },
  'gentle-shell': { name: 'Gentle Shell', desc: 'Design and review agent.' }
}

const STATE_LABELS: Record<CatalogState, string> = {
  installed: 'Installed',
  found: 'Found',
  connected: 'Connected',
  missing: 'Install',
  off: 'Connect'
}

export function isCatalogAgentId(value: string | undefined): value is MarketplaceAppAgent {
  return MARKETPLACE_APP_AGENTS.some((agent) => agent === value)
}

export function catalogAgentName(agent: MarketplaceAppAgent): string {
  return AGENT_COPY[agent].name
}

export function catalogAgentDesc(agent: MarketplaceAppAgent): string {
  return AGENT_COPY[agent].desc
}

/** Gentle Shell is a Pi runtime on the host, so only its runtime report can show it. */
export function isAgentDetected(agent: MarketplaceAppAgent, source: CatalogSource): boolean {
  if (agent === 'gentle-shell') {
    return source.piRuntimes?.includes('gentle-shell') === true
  }
  return source.agentIds?.has(agent) === true
}

export function catalogStateIsOn(state: CatalogState): boolean {
  switch (state) {
    case 'installed':
    case 'found':
    case 'connected':
      return true
    case 'missing':
    case 'off':
      return false
  }
}

export function catalogActionLabel(state: CatalogState): string {
  return STATE_LABELS[state]
}

/** Found is green text, installed and connected are quiet, and the not-yet-set actions are neutral. */
export function catalogActionTone(state: CatalogState): CatalogActionTone {
  switch (state) {
    case 'found':
      return 'ok'
    case 'installed':
    case 'connected':
      return 'quiet'
    case 'missing':
    case 'off':
      return 'secondary'
  }
}

/** The badge a Your apps row carries: found and connected are green, the rest are plain. */
export function catalogBadgeTone(state: CatalogState): 'plain' | 'ok' {
  switch (state) {
    case 'found':
    case 'connected':
      return 'ok'
    case 'installed':
    case 'missing':
    case 'off':
      return 'plain'
  }
}

export type CatalogSection = {
  kind: CatalogKind
  name: string
  count: number
  items: CatalogItem[]
}

/** Sections in board order, for the chosen chip and search text; sections with no rows are left out. */
export function catalogSections(
  items: readonly CatalogItem[],
  tab: CatalogTabId,
  query: string
): CatalogSection[] {
  const needle = query.trim().toLowerCase()
  const matching = items.filter(
    (item) =>
      needle === '' ||
      item.name.toLowerCase().includes(needle) ||
      item.desc.toLowerCase().includes(needle)
  )
  return KIND_ORDER.filter((kind) => tab === 'all' || tab === kind)
    .map((kind) => {
      const sectionItems = matching.filter((item) => item.kind === kind)
      return { kind, name: KIND_NAMES[kind], count: sectionItems.length, items: sectionItems }
    })
    .filter((section) => section.items.length > 0)
}

/**
 * The Your apps row: what the host reports is on it (tools and agents) and the services connected.
 * Board rows are left out, so the count and lists never claim a state the host did not report.
 */
export function catalogYourApps(items: readonly CatalogItem[]): {
  installed: CatalogItem[]
  connected: CatalogItem[]
  count: number
} {
  const on = items.filter((item) => item.source === 'host' && catalogStateIsOn(item.state))
  return {
    installed: on.filter((item) => item.kind !== 'service'),
    connected: on.filter((item) => item.kind === 'service'),
    count: on.length
  }
}
