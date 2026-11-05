import {
  Calendar,
  Folder,
  Gitlab,
  Hexagon,
  Mail,
  SquareTerminal,
  Users,
  type LucideIcon
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { CatalogListState, CatalogRow, CatalogRowStatus } from './MarketplaceCatalogRows'
import type { MarketplaceItemKind } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import {
  checkingLabel,
  connectLabel,
  connectedLabel,
  couldNotCheckLabel,
  desktopOnlyLabel,
  installLabel,
  installedLabel
} from './MarketplaceCatalogStatusCopy'

/** Board rows without an item page. GitHub CLI and GitLab read the CLI check; the rest have nothing behind them yet. */
type BoardRowId = 'gh' | 'node' | 'gitlab' | 'email' | 'calendar' | 'drive' | 'crm'

type BoardRow = {
  id: BoardRowId
  kind: MarketplaceItemKind
  name: string
  description: { key: string; fallback: string }
  glyph: LucideIcon
}

/** Names, lines and icons as the approved Catalog board shows them. */
const BOARD_ROWS: readonly BoardRow[] = [
  {
    id: 'gh',
    kind: 'tool',
    name: 'GitHub CLI',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.githubCliDescription',
      fallback: 'Signs in to GitHub; agents open pull requests with it.'
    },
    glyph: SquareTerminal
  },
  {
    id: 'node',
    kind: 'tool',
    name: 'Node.js',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.nodeDescription',
      fallback: 'Runs the JavaScript tools some agents call.'
    },
    glyph: Hexagon
  },
  {
    id: 'gitlab',
    kind: 'service',
    name: 'GitLab',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.gitlabDescription',
      fallback: 'Repositories, merge requests and issues.'
    },
    glyph: Gitlab
  },
  {
    id: 'email',
    kind: 'service',
    name: 'Email',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.emailDescription',
      fallback: 'Bot teams read and send mail.'
    },
    glyph: Mail
  },
  {
    id: 'calendar',
    kind: 'service',
    name: 'Calendar',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.calendarDescription',
      fallback: 'Bot teams read and add events.'
    },
    glyph: Calendar
  },
  {
    id: 'drive',
    kind: 'service',
    name: 'Shared drive',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.sharedDriveDescription',
      fallback: 'Bot teams read and save shared files.'
    },
    glyph: Folder
  },
  {
    id: 'crm',
    kind: 'service',
    name: '[CRM]',
    description: {
      key: 'auto.components.marketplace.MarketplaceCatalogPlaceholders.crmDescription',
      fallback: 'Bot teams read customers and deals.'
    },
    glyph: Users
  }
]

/** A status the page cannot decide yet, shown as a disabled control. */
export function pendingStatus(badge: MarketplaceBadgeState): CatalogRowStatus | null {
  if (badge === 'checking') {
    return { kind: 'pending', label: checkingLabel() }
  }
  if (badge === 'unknown') {
    return { kind: 'pending', label: couldNotCheckLabel() }
  }
  if (badge === 'desktop-only') {
    return { kind: 'pending', label: desktopOnlyLabel() }
  }
  return null
}

function boardRow(id: BoardRowId, status: CatalogRowStatus, owned: boolean): CatalogRow {
  const meta = BOARD_ROWS.find((row) => row.id === id)
  if (meta === undefined) {
    throw new Error(`Marketplace board has no row ${id}`)
  }
  return {
    key: `board-${id}`,
    section: meta.kind === 'tool' ? 'tools' : 'services',
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
  return ids.map((id) => {
    const kind = BOARD_ROWS.find((row) => row.id === id)?.kind
    const label = kind === 'service' ? connectLabel() : installLabel()
    return boardRow(id, { kind: 'action', label }, false)
  })
}

/** GitHub CLI and GitLab rows: the computer check decides them, and they are owned once installed or signed in. */
export function cliRow(id: 'gh' | 'gitlab', badge: MarketplaceBadgeState): CatalogRow {
  const pending = pendingStatus(badge)
  if (pending !== null) {
    return boardRow(id, pending, false)
  }
  if (id === 'gh') {
    const installed = badge === 'installed'
    const status: CatalogRowStatus = installed
      ? { kind: 'done', label: installedLabel() }
      : { kind: 'action', label: installLabel() }
    return boardRow(id, status, installed)
  }
  const connected = badge === 'signed-in'
  const status: CatalogRowStatus = connected
    ? { kind: 'done', label: connectedLabel() }
    : { kind: 'action', label: connectLabel() }
  return boardRow(id, status, connected)
}

/** The line a catalog section shows in place of its rows while the list is unknown or empty. */
export function listPlaceholder<T>(list: CatalogListState<T>, host: string): string | null {
  switch (list.kind) {
    case 'loading':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogRows.checkingThisComputer',
        'Checking this computer…'
      )
    case 'unavailable':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogRows.notCheckedOnHost',
        'Not checked on {{host}} yet.',
        { host }
      )
    case 'ready':
      return null
  }
}

export function skillsPlaceholder(
  list: CatalogListState<DiscoveredSkill>,
  host: string
): string | null {
  if (list.kind === 'ready' && list.items.length === 0) {
    return translate(
      'auto.components.marketplace.MarketplaceCatalogRows.noSkills',
      'No skills found on {{host}}.',
      { host }
    )
  }
  return listPlaceholder(list, host)
}
