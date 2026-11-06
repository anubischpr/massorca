import { BookOpen, Hexagon, SquareTerminal, type LucideIcon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { MarketplaceItemKind } from './marketplace-catalog'
import type {
  CatalogBadge,
  CatalogRow,
  CatalogRowStatus,
  HostUnanswered,
  MarketplaceCatalogSectionId
} from './MarketplaceCatalogRows'
import {
  checkingLabel,
  couldNotCheckLabel,
  desktopOnlyLabel,
  installLabel,
  installedLabel,
  updateOnHostLabel
} from './MarketplaceCatalogStatusCopy'

/** Board rows without an item page. GitHub CLI reads the CLI check; the rest have nothing behind them yet. */
type BoardRowId = 'gh' | 'node' | 'browser' | 'computer' | 'linear' | 'orch' | 'price'

type BoardRowKind = MarketplaceItemKind | 'skill'

type BoardRow = {
  id: BoardRowId
  kind: BoardRowKind
  name: string
  description: { key: string; fallback: string }
  glyph: LucideIcon
}

const BOARD_COPY = 'auto.components.marketplace.MarketplaceCatalogPlaceholders'

/** Names, lines and icons as the approved Catalog board shows them. */
const BOARD_ROWS: readonly BoardRow[] = [
  {
    id: 'gh',
    kind: 'tool',
    name: 'GitHub CLI',
    description: {
      key: `${BOARD_COPY}.githubCliDescription`,
      fallback: 'Signs in to GitHub; agents open pull requests with it.'
    },
    glyph: SquareTerminal
  },
  {
    id: 'node',
    kind: 'tool',
    name: 'Node.js',
    description: {
      key: `${BOARD_COPY}.nodeDescription`,
      fallback: 'Runs the JavaScript tools some agents call.'
    },
    glyph: Hexagon
  },
  {
    id: 'browser',
    kind: 'skill',
    name: 'Browser use',
    description: {
      key: `${BOARD_COPY}.browserUseDescription`,
      fallback: 'Agents use the browser pane.'
    },
    glyph: BookOpen
  },
  {
    id: 'computer',
    kind: 'skill',
    name: 'Computer use',
    description: {
      key: `${BOARD_COPY}.computerUseDescription`,
      fallback: 'Agents see and control your screen.'
    },
    glyph: BookOpen
  },
  {
    id: 'linear',
    kind: 'skill',
    name: 'Linear',
    description: {
      key: `${BOARD_COPY}.linearDescription`,
      fallback: 'Agents update Linear issues.'
    },
    glyph: BookOpen
  },
  {
    id: 'orch',
    kind: 'skill',
    name: 'Orchestration',
    description: {
      key: `${BOARD_COPY}.orchestrationDescription`,
      fallback: 'Agents hand work to agents.'
    },
    glyph: BookOpen
  },
  {
    id: 'price',
    kind: 'skill',
    name: 'Price check',
    description: {
      key: `${BOARD_COPY}.priceCheckDescription`,
      fallback: 'Made by Development.'
    },
    glyph: BookOpen
  }
]

/** Skill names compare without case, spaces or punctuation, so "Browser use" matches "browser-use". */
export function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

/** The pending control a host check shows while it has no answer this host can give. */
export function unansweredStatus(check: HostUnanswered, host: string): CatalogRowStatus {
  switch (check.kind) {
    case 'loading':
      return { kind: 'pending', label: checkingLabel() }
    case 'failed':
      return { kind: 'pending', label: couldNotCheckLabel() }
    case 'update-required':
      return { kind: 'pending', label: updateOnHostLabel(host) }
  }
}

/** A status the page cannot decide yet, shown as a disabled control. */
export function pendingStatus(badge: CatalogBadge, host: string): CatalogRowStatus | null {
  if (badge === 'checking') {
    return { kind: 'pending', label: checkingLabel() }
  }
  if (badge === 'unknown') {
    return { kind: 'pending', label: couldNotCheckLabel() }
  }
  if (badge === 'update-required') {
    return { kind: 'pending', label: updateOnHostLabel(host) }
  }
  if (badge === 'desktop-only') {
    return { kind: 'pending', label: desktopOnlyLabel() }
  }
  return null
}

function sectionOf(kind: BoardRowKind): MarketplaceCatalogSectionId {
  if (kind === 'tool') {
    return 'tools'
  }
  return kind === 'skill' ? 'skills' : 'services'
}

function boardRow(id: BoardRowId, status: CatalogRowStatus, owned: boolean): CatalogRow {
  const meta = BOARD_ROWS.find((row) => row.id === id)
  if (meta === undefined) {
    throw new Error(`Marketplace board has no row ${id}`)
  }
  return {
    key: `board-${id}`,
    section: sectionOf(meta.kind),
    name: meta.name,
    description: translate(meta.description.key, meta.description.fallback),
    icon: { kind: 'glyph', glyph: meta.glyph },
    status,
    target: null,
    owned,
    service: meta.kind === 'service',
    customId: null
  }
}

/** Board rows nothing backs yet: the action shows disabled, and no status is claimed. */
export function unsetBoardRows(...ids: readonly BoardRowId[]): CatalogRow[] {
  return ids.map((id) => boardRow(id, { kind: 'action', label: installLabel() }, false))
}

/** The board skills the host does not list: each shows the pending control, else Install with no page to open. */
export function boardSkillRows(
  listedNames: ReadonlySet<string>,
  pending: CatalogRowStatus | null
): CatalogRow[] {
  return BOARD_ROWS.filter(
    (row) => row.kind === 'skill' && !listedNames.has(normalizeSkillName(row.name))
  ).map((row) => boardRow(row.id, pending ?? { kind: 'action', label: installLabel() }, false))
}

/** The GitHub CLI row: the host check decides it, and it is owned once installed. */
export function cliRow(id: 'gh', badge: CatalogBadge, host: string): CatalogRow {
  const pending = pendingStatus(badge, host)
  if (pending !== null) {
    return boardRow(id, pending, false)
  }
  const installed = badge === 'installed'
  const status: CatalogRowStatus = installed
    ? { kind: 'done', label: installedLabel() }
    : { kind: 'action', label: installLabel() }
  return boardRow(id, status, installed)
}
