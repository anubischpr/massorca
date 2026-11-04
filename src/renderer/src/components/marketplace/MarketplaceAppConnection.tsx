import { Plus, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { GitHubAccountsCard } from './GitHubAccountsCard'
import { GITHUB_CLI_URL } from './marketplace-catalog'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { copyMarketplaceText } from './marketplace-clipboard'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'

// Why: the app has no sign-in flow of its own; the existing gh command is the way to add an account.
const GH_LOGIN_COMMAND = 'gh auth login'

/** Only what the app needs to connect; no per-agent switches here. */
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

function ConnectAction({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element | null {
  if (!ctx.canConnect) {
    return null
  }
  return (
    <Button type="button" size="sm" disabled={ctx.connectBlocked} onClick={ctx.connect}>
      {translate('auto.components.marketplace.MarketplaceAppConnection.connect', 'Connect')}
    </Button>
  )
}

function EngramConnection({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const program = ctx.status.program
  const installed = program?.found === true
  return (
    <div className="flex flex-col gap-3">
      <MarketplaceInfoRow
        label={translate(
          'auto.components.marketplace.MarketplaceAppConnection.engramOnComputer',
          'Engram on this computer'
        )}
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
        <ConnectAction ctx={ctx} />
      </MarketplaceInfoRow>
      {ctx.canConnect ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceAppConnection.engramConnectHint',
            'Connect sets Engram up for every agent on this computer.'
          )}
        </p>
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

function OpenMetadataConnection({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const stored = ctx.status.credential?.stored === true
  const notSet = translate('auto.components.marketplace.MarketplaceAppConnection.notSet', 'Not set')
  return (
    <div className="flex flex-col gap-3">
      <MarketplaceInfoRow
        label={translate(
          'auto.components.marketplace.MarketplaceAppConnection.serverAddress',
          'Server address'
        )}
      >
        <span className="text-sm text-muted-foreground">
          {ctx.status.serverUrl ? ctx.status.serverUrl : notSet}
        </span>
      </MarketplaceInfoRow>
      <MarketplaceInfoRow
        label={translate('auto.components.marketplace.MarketplaceAppConnection.token', 'Token')}
      >
        <span className="text-sm text-muted-foreground">
          {stored
            ? translate(
                'auto.components.marketplace.MarketplaceAppConnection.tokenStored',
                'Stored in the vault. Never shown.'
              )
            : notSet}
        </span>
        {stored ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ctx.openDialog({ kind: 'openmetadata-token' })}
          >
            {translate('auto.components.marketplace.MarketplaceAppConnection.replace', 'Replace')}
          </Button>
        ) : null}
      </MarketplaceInfoRow>
      <ConnectAction ctx={ctx} />
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void copyMarketplaceText(GH_LOGIN_COMMAND)}
      >
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
