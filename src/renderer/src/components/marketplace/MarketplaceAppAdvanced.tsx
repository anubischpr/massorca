import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { translate } from '@/i18n/i18n'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { MarketplaceAppAccess } from './MarketplaceAppAccess'
import { MarketplaceEngramCloud } from './MarketplaceEngramCloud'
import { MarketplaceEngramImport } from './MarketplaceEngramImport'
import { MarketplaceEngramProgram } from './MarketplaceEngramProgram'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'

/** Settings beyond the basics, open by default; each app shows only its own options. */
export function MarketplaceAppAdvanced({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  return (
    <div data-marketplace-section="advanced" className="flex flex-col gap-3">
      <Collapsible defaultOpen>
        <div className="flex min-h-7 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {translate(
              'auto.components.marketplace.MarketplaceAppAdvanced.title',
              'Advanced options'
            )}
          </h3>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                'auto.components.marketplace.MarketplaceAppAdvanced.toggle',
                'Show or hide advanced options'
              )}
            >
              <ChevronDown />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-4 pt-3">
            {ctx.appId === 'engram' ? <EngramAdvanced ctx={ctx} /> : null}
            {ctx.appId === 'openmetadata' ? <OpenMetadataAdvanced ctx={ctx} /> : null}
            {ctx.appId === 'github' ? <GitHubAdvanced ctx={ctx} /> : null}
            <MarketplaceAppAccess ctx={ctx} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function EngramAdvanced({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const serverUrl = ctx.status.serverUrl
  const stored = ctx.status.credential?.stored === true
  const notSet = translate('auto.components.marketplace.MarketplaceAppAdvanced.notSet', 'Not set')
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          {translate(
            'auto.components.marketplace.MarketplaceAppAdvanced.engramServer',
            'Your Engram server'
          )}
        </p>
        <MarketplaceInfoRow
          label={translate('auto.components.marketplace.MarketplaceAppAdvanced.address', 'Address')}
        >
          <span className="text-sm text-muted-foreground">{serverUrl ? serverUrl : notSet}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ctx.openDialog({ kind: 'engram-server' })}
          >
            {serverUrl
              ? translate('auto.components.marketplace.MarketplaceAppAdvanced.change', 'Change')
              : translate('auto.components.marketplace.MarketplaceAppAdvanced.add', 'Add')}
          </Button>
        </MarketplaceInfoRow>
        <MarketplaceInfoRow
          label={translate('auto.components.marketplace.MarketplaceAppAdvanced.signIn', 'Sign-in')}
        >
          <span className="text-sm text-muted-foreground">
            {stored
              ? translate(
                  'auto.components.marketplace.MarketplaceAppAdvanced.inVault',
                  'In the vault. Never shown.'
                )
              : notSet}
          </span>
          {serverUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => ctx.openDialog({ kind: 'engram-server' })}
            >
              {translate('auto.components.marketplace.MarketplaceAppAdvanced.replace', 'Replace')}
            </Button>
          ) : null}
        </MarketplaceInfoRow>
      </div>
      {serverUrl ? <MarketplaceEngramCloud /> : null}
      <MarketplaceEngramProgram />
      <MarketplaceEngramImport />
    </>
  )
}

function OpenMetadataAdvanced({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const profiles = ctx.status.profiles ?? []
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          {translate(
            'auto.components.marketplace.MarketplaceAppAdvanced.profiles',
            'Profiles from your server'
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceAppAdvanced.profilesHelp',
            'These profiles already exist on your OpenMetadata server. MassOrca never creates or edits anything there.'
          )}
        </p>
      </div>
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceAppAdvanced.noProfiles',
            'No profiles yet.'
          )}
        </p>
      ) : (
        <ul className="flex flex-col">
          {profiles.map((profile) => (
            <li
              key={profile.name}
              className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{profile.name}</p>
                <p className="truncate text-xs text-muted-foreground">{profile.url}</p>
                <p className="text-xs text-muted-foreground">
                  {profile.hasToken
                    ? translate(
                        'auto.components.marketplace.MarketplaceAppAdvanced.tokenInVault',
                        'Its token is in the vault'
                      )
                    : translate(
                        'auto.components.marketplace.MarketplaceAppAdvanced.noToken',
                        'No token'
                      )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => ctx.openDialog({ kind: 'openmetadata-profile', profile })}
                >
                  {translate('auto.components.marketplace.MarketplaceAppAdvanced.edit', 'Edit')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    void ctx.runInline((api) =>
                      api.removeOpenMetadataProfile({ name: profile.name })
                    )
                  }
                >
                  {translate('auto.components.marketplace.MarketplaceAppAdvanced.remove', 'Remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ctx.openDialog({ kind: 'openmetadata-profile', profile: null })}
        >
          <Plus />
          {translate(
            'auto.components.marketplace.MarketplaceAppAdvanced.addProfile',
            'Add a profile'
          )}
        </Button>
      </div>
    </div>
  )
}

function GitHubAdvanced({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const { inventory } = ctx.github
  const active =
    inventory.kind === 'loaded'
      ? inventory.value.accounts.find((account) => account.active)
      : undefined
  return (
    <MarketplaceInfoRow
      label={translate(
        'auto.components.marketplace.MarketplaceAppAdvanced.newProjects',
        'Account for new projects'
      )}
    >
      <span className="text-sm">
        {active
          ? active.user
          : translate('auto.components.marketplace.MarketplaceAppAdvanced.noActive', 'None')}
      </span>
      {active ? (
        <span className="text-xs text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceAppAdvanced.activeNote',
            '(the active account)'
          )}
        </span>
      ) : null}
    </MarketplaceInfoRow>
  )
}
