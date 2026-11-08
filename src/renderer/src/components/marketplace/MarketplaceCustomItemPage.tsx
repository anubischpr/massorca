import { useState } from 'react'
import { Bot, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { useMarketplaceCustomItems } from './MarketplaceCatalogCustom'
import type { CatalogRow } from './MarketplaceCatalogRows'
import {
  MarketplaceBreadcrumb,
  MarketplaceItemHeader,
  type MarketplaceStatusTone
} from './MarketplaceDetail'
import { MarketplaceFormDialog } from './MarketplaceFormDialog'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplaceNotesPage, type MarketplaceNotes } from './MarketplaceNotesPage'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import { pickedHostLabel } from './marketplace-picked-host-label'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

const COPY = 'auto.components.marketplace.MarketplaceCustomItemPage'

const PLATFORMS = [
  { platform: 'win32', label: 'Windows' },
  { platform: 'darwin', label: 'macOS' },
  { platform: 'linux', label: 'Linux' }
] as const

/** A custom tool or agent: its commands, Install on this computer, and Remove from the Marketplace list. */
export function MarketplaceCustomItemPage({
  item,
  onBack
}: {
  item: MarketplaceCustomItemStatus
  onBack: () => void
}): React.JSX.Element {
  const host = useMarketplaceAppHost()
  const custom = useMarketplaceCustomItems()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const hostName = pickedHostLabel(host)
  // Why: custom items are checked and installed on this computer only, so a picked host shows that plainly.
  const onThisComputer = host.selectedKey === null
  const installing = custom.installingIds.has(item.id)
  const installable = onThisComputer && item.presence === 'missing'
  const status: { label: string; tone: MarketplaceStatusTone } = onThisComputer
    ? presenceStatus(item.presence, hostName)
    : {
        label: translate(`${COPY}.notChecked`, 'Not checked on {{host}}', { host: hostName }),
        tone: 'pending'
      }
  const Glyph = item.kind === 'agent' ? Bot : Wrench

  const remove = async (): Promise<void> => {
    setRemoving(true)
    setRemoveError(null)
    const removed = await custom.remove(item.id)
    setRemoving(false)
    if (removed) {
      onBack()
      return
    }
    setRemoveError(translate(`${COPY}.removeFailed`, 'Could not remove this item. Try again.'))
  }

  const installWhy = !onThisComputer
    ? translate(`${COPY}.installRemote`, 'Custom items are installed on this computer only.')
    : translate(
        `${COPY}.installNotOffered`,
        'MassOrca offers no install for this item, because its check does not show it missing.'
      )

  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <MarketplacePageHostRow host={host}>
        <MarketplaceBreadcrumb name={item.name} onBack={onBack} />
      </MarketplacePageHostRow>
      <MarketplaceItemHeader
        icon={<Glyph className="size-6" aria-hidden />}
        name={item.name}
        description={null}
        statusTone={status.tone}
        status={status.label}
        action={
          installable ? (
            <Button
              type="button"
              disabled={installing}
              onClick={() => void custom.install(item.id)}
            >
              {translate(`${COPY}.install`, 'Install')}
            </Button>
          ) : undefined
        }
      />
      {installable ? null : (
        <MarketplaceFunctionNote part="install">{installWhy}</MarketplaceFunctionNote>
      )}
      <MarketplaceFunctionNote part="banner">
        {translate(`${COPY}.banner`, 'Custom items have no example prompts.')}
      </MarketplaceFunctionNote>
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
      >
        <MarketplaceFunctionNote part="connection">
          {translate(
            `${COPY}.connection`,
            'Custom items need no account. MassOrca runs the check command to see whether one is installed.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <CommandRows item={item} />
        <MarketplaceFunctionNote
          part="access"
          label={translate(
            'auto.components.marketplace.MarketplaceAppAccess.title',
            'Who can use it'
          )}
        >
          {item.kind === 'agent'
            ? translate(
                `${COPY}.agentAccess`,
                'Custom agents cannot be turned on or off per host yet.'
              )
            : translate(
                `${COPY}.toolAccess`,
                'Every agent on {{host}} can run it. Limits per agent are not available for tools yet.',
                { host: hostName }
              )}
        </MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        <Card>
          <CardHeader>
            <CardTitle>{translate(`${COPY}.removeTitle`, 'Remove this item')}</CardTitle>
            <CardDescription>
              {translate(
                `${COPY}.removeDescription`,
                'Removes {{name}} from the Marketplace list on this computer. The program it checks stays as it is.',
                { name: item.name }
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setRemoveOpen(true)}
            >
              {translate(`${COPY}.remove`, 'Remove from Marketplace')}
            </Button>
          </CardContent>
        </Card>
      </MarketplaceAppSection>
      {removeOpen ? (
        <MarketplaceFormDialog
          title={translate(`${COPY}.confirmTitle`, 'Remove {{name}}?', { name: item.name })}
          description={translate(
            `${COPY}.removeDescription`,
            'Removes {{name}} from the Marketplace list on this computer. The program it checks stays as it is.',
            { name: item.name }
          )}
          submitLabel={translate(`${COPY}.remove`, 'Remove from Marketplace')}
          destructive
          pending={removing}
          error={removeError}
          onSubmit={() => void remove()}
          onClose={() => setRemoveOpen(false)}
        />
      ) : null}
    </div>
  )
}

/** A custom item on a picked host: it is checked on this computer only, so the host has no page of its own yet. */
export function MarketplaceCustomUnavailablePage({
  row,
  onBack
}: {
  row: CatalogRow
  onBack: () => void
}): React.JSX.Element {
  const host = useMarketplaceAppHost()
  const hostName = pickedHostLabel(host)
  const notes: MarketplaceNotes = {
    install: translate(
      `${COPY}.unavailableInstall`,
      '{{section}} are checked on this computer only. {{host}} has no check for them yet.',
      { section: row.name, host: hostName }
    ),
    banner: translate(`${COPY}.banner`, 'Custom items have no example prompts.'),
    connection: translate(
      `${COPY}.connection`,
      'Custom items need no account. MassOrca runs the check command to see whether one is installed.'
    ),
    access: translate(`${COPY}.unavailableAccess`, 'Not available on {{host}} yet.', {
      host: hostName
    }),
    advanced: translate(
      `${COPY}.unavailableAdvanced`,
      'Nothing to set for these on {{host}} yet.',
      {
        host: hostName
      }
    ),
    uninstall: translate(
      `${COPY}.unavailableUninstall`,
      'Custom items are removed on this computer.'
    )
  }
  return <MarketplaceNotesPage row={row} host={host} notes={notes} onBack={onBack} />
}

function presenceStatus(
  presence: MarketplaceCustomItemStatus['presence'],
  hostName: string
): { label: string; tone: MarketplaceStatusTone } {
  switch (presence) {
    case 'found':
      return {
        label: translate(`${COPY}.found`, 'Installed on {{host}}', { host: hostName }),
        tone: 'ok'
      }
    case 'missing':
      return {
        label: translate(`${COPY}.missing`, 'Not installed on {{host}}', { host: hostName }),
        tone: 'warn'
      }
    case 'unverifiable':
      return {
        label: translate(`${COPY}.unverifiable`, 'Could not check {{host}}', { host: hostName }),
        tone: 'pending'
      }
  }
}

/** The check command and the install command per platform, read-only: MassOrca has no editor for them yet. */
function CommandRows({ item }: { item: MarketplaceCustomItemStatus }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <CommandRow
        label={translate(`${COPY}.checkCommand`, 'Check command')}
        value={item.checkCommand?.join(' ') ?? translate(`${COPY}.none`, 'None')}
      />
      {PLATFORMS.map(({ platform, label }) => (
        <CommandRow
          key={platform}
          label={translate(`${COPY}.installOn`, 'Install on {{platform}}', { platform: label })}
          value={item.install[platform]?.join(' ') ?? translate(`${COPY}.notSet`, 'Not set')}
        />
      ))}
    </div>
  )
}

function CommandRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <span className="break-all font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  )
}
