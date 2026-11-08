import { Database, Plus, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { GitHubAccountsCard } from './GitHubAccountsCard'
import { GITHUB_CLI_URL } from './marketplace-catalog'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'
import { credentialSummary } from './marketplace-vault-credential-text'
import { MarketplaceVaultHosts } from './MarketplaceVaultHosts'
import { useMarketplacePreflight } from './use-marketplace-preflight'

// Why: the app has no sign-in flow of its own; the existing gh command is the way to add an account.
const GH_LOGIN_COMMAND = 'gh auth login'

/** Only what the app needs to connect; no per-agent switches here. Connect itself lives in the header. */
export function MarketplaceAppConnection({
  ctx
}: {
  ctx: MarketplaceAppContext
}): React.JSX.Element {
  return (
    <MarketplaceAppSection
      id="connection"
      title={translate('auto.components.marketplace.MarketplaceAppConnection.title', 'Connection')}
      action={ctx.appId === 'github' ? <GitHubAddAccount ctx={ctx} /> : null}
    >
      {ctx.appId === 'engram' ? <EngramConnection ctx={ctx} /> : null}
      {ctx.appId === 'openmetadata' ? <OpenMetadataConnection ctx={ctx} /> : null}
      {ctx.appId === 'github' ? <GitHubConnection ctx={ctx} /> : null}
    </MarketplaceAppSection>
  )
}

function EngramConnection({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const program = ctx.status.program
  const installed = program?.found === true
  return (
    <div className="flex flex-col gap-3">
      <MarketplaceInfoRow
        label={
          ctx.hostLabel
            ? translate(
                'auto.components.marketplace.MarketplaceAppConnection.engramOnHost',
                'Engram on {{host}}',
                { host: ctx.hostLabel }
              )
            : translate(
                'auto.components.marketplace.MarketplaceAppConnection.engramOnComputer',
                'Engram on this computer'
              )
        }
      >
        {program?.found && program.version ? (
          <span className="text-sm text-muted-foreground">{program.version}</span>
        ) : null}
        {program ? (
          <Badge variant={installed ? 'secondary' : 'outline'}>
            {installed
              ? translate(
                  'auto.components.marketplace.MarketplaceAppConnection.installed',
                  'Installed'
                )
              : translate(
                  'auto.components.marketplace.MarketplaceAppConnection.notFound',
                  'Not found'
                )}
          </Badge>
        ) : null}
        {program && !installed ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => void window.api.shell.openUrl(ctx.info.website)}
          >
            {translate(
              'auto.components.marketplace.MarketplaceAppConnection.installInstructions',
              'Install instructions'
            )}
          </Button>
        ) : null}
      </MarketplaceInfoRow>
      {ctx.canConnect ? (
        <p className="text-xs text-muted-foreground">
          {ctx.hostLabel
            ? translate(
                'auto.components.marketplace.MarketplaceAppConnection.engramConnectHintHost',
                'Connect sets Engram up for every agent on {{host}}.',
                { host: ctx.hostLabel }
              )
            : translate(
                'auto.components.marketplace.MarketplaceAppConnection.engramConnectHint',
                'Connect sets Engram up for every agent on this computer.'
              )}
        </p>
      ) : null}
      {ctx.status.credential?.stored ? (
        <MarketplaceInfoRow
          label={translate(
            'auto.components.marketplace.MarketplaceAppConnection.serverToken',
            'Server token'
          )}
        >
          <span className="text-sm text-muted-foreground">
            {credentialSummary(ctx.status.credential) ?? ''}
          </span>
        </MarketplaceInfoRow>
      ) : null}
      {ctx.status.serverUrl && !ctx.hostLabel ? (
        <MarketplaceVaultHosts slot="engram-cloud" />
      ) : null}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceAppConnection.engramHelp',
          'Nothing to sign in to: memories stay on this computer unless you add your own Engram server in Advanced options.'
        )}
      </p>
    </div>
  )
}

/** The board's two rows: the icon tile, the name, one line of detail, and the row's action. */
export function ConnectionRow({
  icon,
  name,
  sub,
  action
}: {
  icon: React.ReactNode
  name: string
  sub: string
  action: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      {action}
    </div>
  )
}

function OpenMetadataConnection({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const stored = ctx.status.credential?.stored === true
  const notSet = translate('auto.components.marketplace.MarketplaceAppConnection.notSet', 'Not set')
  const databaseIcon = <Database className="size-4 text-foreground" aria-hidden />
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col rounded-xl border border-border bg-card">
        <ConnectionRow
          icon={databaseIcon}
          name={translate(
            'auto.components.marketplace.MarketplaceAppConnection.serverAddress',
            'Server address'
          )}
          sub={ctx.status.serverUrl ?? notSet}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => ctx.openDialog({ kind: 'openmetadata-connect' })}
            >
              {translate('auto.components.marketplace.MarketplaceAppConnection.change', 'Change')}
            </Button>
          }
        />
        <ConnectionRow
          icon={databaseIcon}
          name={translate('auto.components.marketplace.MarketplaceAppConnection.token', 'Token')}
          sub={
            stored
              ? (credentialSummary(ctx.status.credential ?? {}) ??
                translate(
                  'auto.components.marketplace.MarketplaceAppConnection.tokenStored',
                  'Stored in the vault. Never shown.'
                ))
              : translate(
                  'auto.components.marketplace.MarketplaceAppConnection.tokenNotSet',
                  'Not set. Kept in the MassOrca vault and never shown once saved.'
                )
          }
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => ctx.openDialog({ kind: 'openmetadata-token' })}
            >
              {stored
                ? translate(
                    'auto.components.marketplace.MarketplaceAppConnection.replace',
                    'Replace'
                  )
                : translate(
                    'auto.components.marketplace.MarketplaceAppConnection.addToken',
                    'Add token'
                  )}
            </Button>
          }
        />
      </div>
      {ctx.hostLabel ? null : (
        <MarketplaceVaultHosts
          slot="openmetadata"
          profiles={ctx.status.profiles?.map((profile) => profile.name) ?? []}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceAppConnection.openMetadataHelp',
          'One standard connection for every agent. MassOrca never creates or changes anything on the OpenMetadata server.'
        )}
      </p>
    </div>
  )
}

function GitHubConnection({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  // Why: this section mounts only when the GitHub page opens, so the forced check runs once per visit.
  useMarketplacePreflight({ refreshOnMount: false, forceOnMount: true })
  const gh = ctx.preflight.preflight?.gh
  return (
    <div className="flex flex-col gap-3">
      {gh && !gh.installed ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm">
            {translate(
              'auto.components.marketplace.MarketplaceAppConnection.ghNotInstalled',
              'The GitHub CLI (gh) is not installed on this computer.'
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void window.api.shell.openUrl(GITHUB_CLI_URL)}
          >
            {translate(
              'auto.components.marketplace.MarketplaceAppConnection.getCli',
              'Get GitHub CLI'
            )}
          </Button>
        </div>
      ) : null}
      {gh?.installed && !gh.authenticated ? (
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.MarketplaceAppConnection.ghSignIn',
            'Sign in with {{command}} on this computer.',
            { command: GH_LOGIN_COMMAND }
          )}
        </p>
      ) : null}
      <GitHubAccountsCard accounts={ctx.github} />
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceAppConnection.githubHelp',
          'Accounts stay in the GitHub CLI on each host; MassOrca never holds the token.'
        )}
      </p>
    </div>
  )
}

function GitHubAddAccount({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={() => ctx.github.openSignIn()}>
        <Plus />
        {translate(
          'auto.components.marketplace.MarketplaceAppConnection.addAccount',
          'Add account'
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={translate(
          'auto.components.marketplace.MarketplaceAppConnection.refreshAccounts',
          'Refresh accounts'
        )}
        onClick={() => void ctx.github.reload()}
      >
        <RotateCw />
      </Button>
    </div>
  )
}
