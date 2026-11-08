import { BookOpen } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import {
  MarketplaceBreadcrumb,
  MarketplaceItemHeader,
  type MarketplaceStatusTone
} from './MarketplaceDetail'
import { MarketplaceFunctionNote, type MarketplaceNotePart } from './MarketplaceFunctionNote'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import type { CatalogRow, CatalogRowStatus } from './MarketplaceCatalogRows'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

/** One why line per function the page does not have; every part of the page has one. */
export type MarketplaceNotes = Record<MarketplaceNotePart, string>

/** A row's status line tone: a done or found row is ok, an action is a warning, a pending check is neutral. */
export function rowStatusTone(status: CatalogRowStatus): MarketplaceStatusTone {
  if (status.kind === 'done' || status.kind === 'found') {
    return 'ok'
  }
  return status.kind === 'action' ? 'warn' : 'pending'
}

/**
 * The page for a row with no function of its own to offer: the same header, host picker and sections
 * as every other page, with a why line where a function cannot exist.
 */
export function MarketplaceNotesPage({
  row,
  host,
  notes,
  status,
  onBack
}: {
  row: CatalogRow
  host: MarketplaceAppHost
  notes: MarketplaceNotes
  /** The header's status line, when the row's own label is an action rather than a state. */
  status?: { label: string; tone: MarketplaceStatusTone }
  onBack: () => void
}): React.JSX.Element {
  const Glyph = row.icon.kind === 'glyph' ? row.icon.glyph : BookOpen
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <MarketplacePageHostRow host={host}>
        <MarketplaceBreadcrumb name={row.name} onBack={onBack} />
      </MarketplacePageHostRow>
      <MarketplaceItemHeader
        icon={<Glyph className="size-6" aria-hidden />}
        name={row.name}
        description={row.description || null}
        statusTone={status?.tone ?? rowStatusTone(row.status)}
        status={status?.label ?? row.status.label}
      />
      <MarketplaceFunctionNote part="install">{notes.install}</MarketplaceFunctionNote>
      <MarketplaceFunctionNote part="banner">{notes.banner}</MarketplaceFunctionNote>
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
      >
        <MarketplaceFunctionNote part="connection">{notes.connection}</MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <MarketplaceFunctionNote
          part="access"
          label={translate(
            'auto.components.marketplace.MarketplaceAppAccess.title',
            'Who can use it'
          )}
        >
          {notes.access}
        </MarketplaceFunctionNote>
        <MarketplaceFunctionNote part="advanced">{notes.advanced}</MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        <MarketplaceFunctionNote part="uninstall">{notes.uninstall}</MarketplaceFunctionNote>
      </MarketplaceAppSection>
    </div>
  )
}
