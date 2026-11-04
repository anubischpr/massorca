import type { LucideIcon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { MARKETPLACE_CATALOG, type MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import {
  connectLabel,
  connectedLabel,
  couldNotCheckLabel,
  foundLabel,
  installLabel,
  installedLabel,
  installingLabel
} from './MarketplaceCatalogStatusCopy'
import {
  cliRow,
  listPlaceholder,
  pendingStatus,
  skillsPlaceholder,
  unsetBoardRows
} from './MarketplaceCatalogPlaceholders'

/** The sidebar's choice: every section, or one section. */
export type MarketplaceCatalogFilter = 'all' | 'tools' | 'agents' | 'skills' | 'services'
export type MarketplaceCatalogSectionId = Exclude<MarketplaceCatalogFilter, 'all'>

/** What opening a row leads to. Custom items have no page of their own. */
export type CatalogRowTarget =
  | { kind: 'item'; id: MarketplaceItemId }
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'skill'; skill: DiscoveredSkill }

export type CatalogRowIcon =
  | { kind: 'item'; id: MarketplaceItemId }
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'skill' }
  | { kind: 'custom'; itemKind: MarketplaceCustomItemStatus['kind'] }
  | { kind: 'glyph'; glyph: LucideIcon }

/** The row's right-hand control: done, found, an action to take, or nothing to do yet. */
export type CatalogRowStatus =
  | { kind: 'done'; label: string }
  | { kind: 'found'; label: string }
  | { kind: 'action'; label: string }
  | { kind: 'pending'; label: string }

export type CatalogRow = {
  key: string
  section: MarketplaceCatalogSectionId
  name: string
  /** One line; empty when there is nothing honest to show. */
  description: string
  icon: CatalogRowIcon
  status: CatalogRowStatus
  target: CatalogRowTarget | null
  /** Installed, found or connected on the host the page shows. */
  owned: boolean
  /** A connected account rather than an installed program. */
  service: boolean
  /** Set on custom items, which the grid can install. */
  customId: string | null
}

export type CatalogSection = {
  id: MarketplaceCatalogSectionId
  name: string
  note: string
  rows: CatalogRow[]
  /** Shown in place of the rows while they are unknown or empty. */
  placeholder: string | null
}

/** A list read on this computer: still loading, not read for the host shown, or its items. */
export type CatalogListState<T> =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; items: readonly T[] }

/** The GitHub CLI and GitLab CLI states the computer check reports. */
export type CliBadges = { gh: MarketplaceBadgeState; gitlab: MarketplaceBadgeState }

export type CatalogBuildInputs = {
  hostLabel: string
  badgeFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  cli: CliBadges
  agentEntries: readonly { id: TuiAgent; label: string }[]
  detectedAgents: CatalogListState<TuiAgent>
  skills: CatalogListState<DiscoveredSkill>
  custom: CatalogListState<MarketplaceCustomItemStatus>
  installingCustomIds: ReadonlySet<string>
}

export function buildCatalogSections(inputs: CatalogBuildInputs): CatalogSection[] {
  const host = inputs.hostLabel
  return [
    {
      id: 'tools',
      name: translate('auto.components.marketplace.MarketplaceSidebar.tools', 'Tools'),
      note: translate(
        'auto.components.marketplace.MarketplaceCatalogRows.toolsNote',
        'On {{host}}',
        {
          host
        }
      ),
      rows: [
        itemRow(inputs, 'git', 'tools'),
        cliRow('gh', inputs.cli.gh),
        ...unsetBoardRows('node'),
        itemRow(inputs, 'engram', 'tools'),
        ...customRows(inputs, 'tool', 'tools')
      ],
      placeholder: null
    },
    {
      id: 'agents',
      name: translate('auto.components.marketplace.MarketplaceSidebar.agents', 'Agents'),
      note: translate(
        'auto.components.marketplace.MarketplaceCatalogRows.agentsNote',
        'On {{host}}. Each host has its own.',
        { host }
      ),
      rows: [...agentRows(inputs), ...customRows(inputs, 'agent', 'agents')],
      placeholder: listPlaceholder(inputs.detectedAgents, host)
    },
    {
      id: 'skills',
      name: translate('auto.components.marketplace.MarketplaceSidebar.skills', 'Skills'),
      note: translate(
        'auto.components.marketplace.MarketplaceCatalogRows.skillsNote',
        'For the agents on {{host}}',
        { host }
      ),
      rows: skillRows(inputs),
      placeholder: skillsPlaceholder(inputs.skills, host)
    },
    {
      id: 'services',
      name: translate('auto.components.marketplace.MarketplaceSidebar.services', 'Services'),
      note: translate(
        'auto.components.marketplace.MarketplaceCatalogRows.servicesNote',
        'Accounts are kept on each host'
      ),
      rows: [
        itemRow(inputs, 'openmetadata', 'services'),
        itemRow(inputs, 'github', 'services'),
        cliRow('gitlab', inputs.cli.gitlab),
        ...unsetBoardRows('email', 'calendar', 'drive', 'crm')
      ],
      placeholder: null
    }
  ]
}

/** Every row that is installed, found or connected, in section order. */
export function ownedRows(sections: readonly CatalogSection[]): CatalogRow[] {
  return sections.flatMap((section) => section.rows.filter((row) => row.owned))
}

export function rowMatchesQuery(row: CatalogRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return true
  }
  return row.name.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle)
}

function itemRow(
  inputs: CatalogBuildInputs,
  id: MarketplaceItemId,
  section: MarketplaceCatalogSectionId
): CatalogRow {
  const item = MARKETPLACE_CATALOG.find((candidate) => candidate.id === id)
  if (item === undefined) {
    throw new Error(`Marketplace catalog has no item ${id}`)
  }
  const { status, owned } = itemStatus(id, inputs.badgeFor(id))
  return {
    key: `item-${id}`,
    section,
    name: item.name,
    description: translate(item.description.key, item.description.fallback),
    icon: { kind: 'item', id },
    status,
    target: { kind: 'item', id },
    owned,
    service: item.kind === 'service',
    customId: null
  }
}

type ItemState = { status: CatalogRowStatus; owned: boolean }

function itemStatus(id: MarketplaceItemId, badge: MarketplaceBadgeState): ItemState {
  const pending = pendingStatus(badge)
  if (pending !== null) {
    return { status: pending, owned: false }
  }
  switch (id) {
    case 'git':
      return badge === 'installed'
        ? { status: { kind: 'done', label: installedLabel() }, owned: true }
        : { status: { kind: 'action', label: installLabel() }, owned: false }
    case 'engram':
      return badge === 'connected'
        ? { status: { kind: 'done', label: installedLabel() }, owned: true }
        : { status: { kind: 'action', label: installLabel() }, owned: false }
    case 'github':
      return badge === 'signed-in'
        ? { status: { kind: 'done', label: connectedLabel() }, owned: true }
        : { status: { kind: 'action', label: connectLabel() }, owned: false }
    case 'openmetadata':
      return badge === 'connected'
        ? { status: { kind: 'done', label: connectedLabel() }, owned: true }
        : { status: { kind: 'action', label: connectLabel() }, owned: false }
  }
}

function agentRows(inputs: CatalogBuildInputs): CatalogRow[] {
  if (inputs.detectedAgents.kind !== 'ready') {
    return []
  }
  const detected = new Set<TuiAgent>(inputs.detectedAgents.items)
  // Why: agents found on this computer lead the section, the rest follow in catalog order.
  const rows = inputs.agentEntries.map((entry) => agentRow(entry, detected.has(entry.id)))
  return [...rows.filter((row) => row.owned), ...rows.filter((row) => !row.owned)]
}

function agentRow(entry: { id: TuiAgent; label: string }, found: boolean): CatalogRow {
  return {
    key: `agent-${entry.id}`,
    section: 'agents',
    name: entry.label,
    description: '',
    icon: { kind: 'agent', agent: entry.id },
    status: found
      ? { kind: 'found', label: foundLabel() }
      : { kind: 'action', label: installLabel() },
    target: { kind: 'agent', agent: entry.id },
    owned: found,
    service: false,
    customId: null
  }
}

function skillRows(inputs: CatalogBuildInputs): CatalogRow[] {
  if (inputs.skills.kind !== 'ready') {
    return []
  }
  return inputs.skills.items.map((skill): CatalogRow => ({
    key: `skill-${skill.id}`,
    section: 'skills',
    name: skill.name,
    description: skill.description || skill.sourceLabel,
    icon: { kind: 'skill' },
    status: skill.installed
      ? { kind: 'done', label: installedLabel() }
      : { kind: 'action', label: installLabel() },
    target: { kind: 'skill', skill },
    owned: skill.installed,
    service: false,
    customId: null
  }))
}

function customRows(
  inputs: CatalogBuildInputs,
  itemKind: MarketplaceCustomItemStatus['kind'],
  section: MarketplaceCatalogSectionId
): CatalogRow[] {
  if (inputs.custom.kind !== 'ready') {
    return []
  }
  return inputs.custom.items
    .filter((item) => item.kind === itemKind)
    .map((item): CatalogRow => {
      const installing = inputs.installingCustomIds.has(item.id)
      return {
        key: `custom-${item.id}`,
        section,
        name: item.name,
        description: item.checkCommand?.join(' ') ?? '',
        icon: { kind: 'custom', itemKind: item.kind },
        status: customStatus(item.presence, installing),
        target: null,
        owned: !installing && item.presence === 'found',
        service: false,
        customId: item.id
      }
    })
}

function customStatus(
  presence: MarketplaceCustomItemStatus['presence'],
  installing: boolean
): CatalogRowStatus {
  if (installing) {
    return { kind: 'pending', label: installingLabel() }
  }
  switch (presence) {
    case 'found':
      return { kind: 'done', label: installedLabel() }
    case 'missing':
      return { kind: 'action', label: installLabel() }
    case 'unverifiable':
      return { kind: 'pending', label: couldNotCheckLabel() }
  }
}
