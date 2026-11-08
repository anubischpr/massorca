import { BookOpen, Hexagon, SquareTerminal, type LucideIcon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type {
  BoardToolId,
  CatalogBadge,
  CatalogRow,
  CatalogRowStatus,
  CatalogRowTarget,
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

/** Board rows: the tools that have a page of their own, and the MassOrca board skills. */
type BoardRowId = 'gh' | 'node' | 'browser' | 'computer' | 'linear' | 'orch' | 'price'

type BoardRowBase = {
  id: BoardRowId
  name: string
  description: { key: string; fallback: string }
  glyph: LucideIcon
}

type BoardToolMeta = BoardRowBase & { kind: 'tool'; toolId: BoardToolId }
type BoardSkillMeta = BoardRowBase & { kind: 'skill'; skillName: string }
type BoardRowMeta = BoardToolMeta | BoardSkillMeta

const BOARD_COPY = 'auto.components.marketplace.MarketplaceCatalogPlaceholders'

/** Names, lines and icons as the approved Catalog board shows them; skill names are the folder names on a host. */
const BOARD_ROWS: readonly BoardRowMeta[] = [
  {
    id: 'gh',
    kind: 'tool',
    toolId: 'gh',
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
    toolId: 'node',
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
    skillName: 'browser-use',
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
    skillName: 'computer-use',
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
    skillName: 'linear',
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
    skillName: 'orchestration',
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
    skillName: 'price-check',
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

/** Whether a name is one of MassOrca's own board skills, however it is spelled. */
export function isBoardSkillName(name: string): boolean {
  const key = normalizeSkillName(name)
  return BOARD_ROWS.some((row) => row.kind === 'skill' && normalizeSkillName(row.name) === key)
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

function sectionOf(kind: BoardRowMeta['kind']): MarketplaceCatalogSectionId {
  return kind === 'tool' ? 'tools' : 'skills'
}

function boardTargetOf(meta: BoardRowMeta, description: string): CatalogRowTarget {
  return meta.kind === 'tool'
    ? { kind: 'board-tool', id: meta.toolId }
    : { kind: 'board-skill', name: meta.skillName, description }
}

function boardRow(id: BoardRowId, status: CatalogRowStatus, owned: boolean): CatalogRow {
  const meta = BOARD_ROWS.find((row) => row.id === id)
  if (meta === undefined) {
    throw new Error(`Marketplace board has no row ${id}`)
  }
  const description = translate(meta.description.key, meta.description.fallback)
  return {
    key: `board-${id}`,
    section: sectionOf(meta.kind),
    name: meta.name,
    description,
    icon: { kind: 'glyph', glyph: meta.glyph },
    status,
    target: boardTargetOf(meta, description),
    owned,
    service: false,
    customId: null
  }
}

/** Board rows nothing backs yet: the install shows disabled, and no status is claimed; the row opens its page. */
export function unsetBoardRows(...ids: readonly BoardRowId[]): CatalogRow[] {
  return ids.map((id) => boardRow(id, { kind: 'pending', label: installLabel() }, false))
}

/** The board skills the host does not list: each shows the pending control, else Install with a page to open. */
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
  // Why: MassOrca cannot install GitHub CLI, so the install stays disabled while the row opens its page.
  const status: CatalogRowStatus = installed
    ? { kind: 'done', label: installedLabel() }
    : { kind: 'pending', label: installLabel() }
  return boardRow(id, status, installed)
}
