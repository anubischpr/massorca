import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  GitInstallBeforeBoard,
  GitInstallFailedBoard,
  GitInstallInstalledBoard,
  GitInstallInstallingBoard,
  GitInstallOutsideBoard,
  GitInstallUnverifiableBoard
} from './GitInstallBoards'
import { useGitInstallController } from './GitInstallController'
import type { GitInstallView } from './GitInstallState'
import { GIT_DOWNLOADS_URL } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'

/** Git's card: a picked host reports its own Git state; This computer gets the install and adopt boards. */
export function GitDetail({
  state,
  hostLabel
}: {
  state: MarketplaceBadgeState
  /** The picked host's name; null for This computer. */
  hostLabel: string | null
}): React.JSX.Element {
  if (hostLabel !== null) {
    return <RemoteGitState state={state} host={hostLabel} />
  }
  return <ThisComputerGitDetail state={state} />
}

/** This computer's Git: live install progress, the installed facts, and the failure board with a manual command. */
function ThisComputerGitDetail({ state }: { state: MarketplaceBadgeState }): React.JSX.Element {
  const controller = useGitInstallController()
  const view = controller.view
  switch (view.kind) {
    case 'before':
      return <GitInstallBeforeBoard plan={view.plan} onInstall={controller.install} />
    case 'installing':
      return <GitInstallInstallingBoard steps={view.steps} log={view.log} />
    case 'installed':
      return <GitInstallInstalledBoard version={view.version} path={view.path} />
    case 'outside':
      return (
        <GitInstallOutsideBoard
          health="works"
          version={view.version}
          path={view.path}
          owner={view.owner}
          onAdopt={controller.adopt}
        />
      )
    case 'broken':
      return (
        <GitInstallOutsideBoard
          health="broken"
          version={null}
          path={view.path}
          owner={view.owner}
          onAdopt={controller.adopt}
        />
      )
    case 'too-old':
      return (
        <GitInstallOutsideBoard
          health="too-old"
          version={view.version}
          path={view.path}
          owner={null}
          onAdopt={controller.adopt}
        />
      )
    case 'unverifiable':
      return <GitInstallUnverifiableBoard onCheckAgain={controller.recheck} />
    case 'failed':
      return <GitInstallFailedBoard reason={view.reason} manualCommand={view.manualCommand} />
    case 'checking':
    case 'unavailable':
      return <BadgeFallback state={state} view={view} />
  }
}

/** A picked host's Git as that host reports it; installing Git there is not offered yet. */
function RemoteGitState({
  state,
  host
}: {
  state: MarketplaceBadgeState
  host: string
}): React.JSX.Element {
  if (state === 'installed') {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.GitDetail.remoteInstalled',
          'Git is installed on {{host}}.',
          { host }
        )}
      </p>
    )
  }
  if (state === 'not-installed') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitDetail.remoteNotInstalled',
            'Git is not installed on {{host}}.',
            { host }
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitDetail.remoteInstallLater',
            'Installing Git on {{host}} is not available yet.',
            { host }
          )}
        </p>
      </div>
    )
  }
  if (state === 'checking') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitDetail.remoteChecking',
          'Checking Git on {{host}}…',
          { host }
        )}
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {translate(
        'auto.components.marketplace.GitDetail.remoteUnknown',
        'Could not check Git on {{host}}.',
        { host }
      )}
    </p>
  )
}

/** Shown only while the check runs or when the bridge is missing; the badge is the only signal then. */
function BadgeFallback({
  state,
  view
}: {
  state: MarketplaceBadgeState
  view: GitInstallView
}): React.JSX.Element {
  if (view.kind === 'checking' && state !== 'installed' && state !== 'not-installed') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitDetail.checking',
          'Checking Git on this computer…'
        )}
      </p>
    )
  }
  if (state === 'installed') {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.GitDetail.installed',
          'Git is installed on this computer.'
        )}
      </p>
    )
  }
  if (state === 'not-installed') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitDetail.notInstalled',
            'Git is not installed on this computer.'
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void window.api.shell.openUrl(GIT_DOWNLOADS_URL)}
        >
          {translate('auto.components.marketplace.GitDetail.getGit', 'Get Git')}
        </Button>
      </div>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {translate(
        'auto.components.marketplace.GitDetail.unknown',
        'Could not check Git on this computer.'
      )}
    </p>
  )
}
