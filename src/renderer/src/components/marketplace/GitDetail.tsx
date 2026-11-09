import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
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
import { MarketplaceHostProgramInstall } from './MarketplaceHostProgramControls'
import {
  useMarketplaceHostProgram,
  type MarketplaceHostProgram
} from './use-marketplace-host-program'
import type { MarketplaceBadgeState } from './marketplace-status'

/** Git's controls on one page, read once: This computer's install board and the program on the picked host. */
export type GitDetailControls = {
  controller: ReturnType<typeof useGitInstallController>
  /** Install (the card) and Uninstall (the Danger zone) both read this one instance. */
  program: MarketplaceHostProgram | null
}

/** Holds a Git page's controls once per page, so the card's Install and the Danger zone's Uninstall agree. */
export function useGitDetailControls(hostLabel: string | null): GitDetailControls {
  const controller = useGitInstallController()
  // Why the store key: a resolved host label means the pick is a live target, and the pick is that key.
  const pickedKey = useAppStore((s) => s.marketplaceHostKey)
  const onThisComputer = hostLabel === null
  const program = useMarketplaceHostProgram(
    'git',
    onThisComputer ? 'local' : (pickedKey ?? 'local'),
    () => {
      if (onThisComputer) {
        controller.recheck()
        void useAppStore.getState().refreshPreflightStatus({ force: true })
      }
    }
  )
  return { controller, program }
}

/** Git's card: a picked host reports its own Git state; This computer gets the install and adopt boards. */
export function GitDetail({
  state,
  hostLabel,
  controls
}: {
  state: MarketplaceBadgeState
  /** The picked host's name; null for This computer. */
  hostLabel: string | null
  controls: GitDetailControls
}): React.JSX.Element {
  if (hostLabel !== null) {
    return <RemoteGitState state={state} host={hostLabel} program={controls.program} />
  }
  return <ThisComputerGitBoard state={state} controller={controls.controller} />
}

function ThisComputerGitBoard({
  state,
  controller
}: {
  state: MarketplaceBadgeState
  controller: ReturnType<typeof useGitInstallController>
}): React.JSX.Element {
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

/** A picked host's Git as that host reports it; Install is here, and Uninstall sits in the Danger zone. */
function RemoteGitState({
  state,
  host,
  program
}: {
  state: MarketplaceBadgeState
  host: string
  program: MarketplaceHostProgram | null
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
        {program ? <MarketplaceHostProgramInstall program={program} host={host} /> : null}
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
