import { Circle, CircleCheck, CircleDashed, CircleX, LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  GIT_MINIMUM_VERSION,
  type GitInstallFailureReason,
  type GitInstallManager,
  type GitInstallPlanView,
  type GitOwner
} from '../../../../shared/marketplace-install'
import { copyMarketplaceText } from './marketplace-clipboard'
import type { GitInstallStepRow } from './GitInstallState'

const MANAGER_LABELS: Record<GitInstallManager, string> = {
  winget: 'winget',
  homebrew: 'Homebrew',
  'xcode-clt': 'Apple Command Line Tools',
  apt: 'apt',
  dnf: 'dnf'
}

const OWNER_LABELS: Record<GitOwner, string> = {
  winget: 'winget',
  homebrew: 'Homebrew',
  apt: 'apt',
  dnf: 'dnf',
  unknown: 'an installer MassOrca does not know'
}

function CommandBlock({ command }: { command: string }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <code className="min-w-0 break-all font-mono text-xs">{command}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void copyMarketplaceText(command)}
      >
        {translate('auto.components.marketplace.GitInstall.copy', 'Copy')}
      </Button>
    </div>
  )
}

function Heading({ children }: { children: string }): React.JSX.Element {
  return <h3 className="text-sm font-medium">{children}</h3>
}

function Elevation({ plan }: { plan: GitInstallPlanView }): React.JSX.Element | null {
  const elevations = new Set(plan.steps.map((step) => step.elevation))
  if (elevations.has('sudo')) {
    return (
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitInstall.sudoNote',
          'This may need an administrator password. MassOrca never asks for it; if one is needed, you get the command to run yourself.'
        )}
      </p>
    )
  }
  if (elevations.has('os-prompt')) {
    return (
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitInstall.osPromptNote',
          'Your computer may ask you to allow the installer.'
        )}
      </p>
    )
  }
  return null
}

/** Git: before installing. What will happen, the exact command, and Install. */
export function GitInstallBeforeBoard({
  plan,
  onInstall
}: {
  plan: GitInstallPlanView
  onInstall: () => void
}): React.JSX.Element {
  if (plan.manager === null || plan.command === null) {
    return <UnsupportedNotice manualCommand={plan.manualCommand} />
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.GitDetail.notInstalled',
          'Git is not installed on this computer.'
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitInstall.willRun',
          'MassOrca will install Git with {{manager}} by running this command:',
          { manager: MANAGER_LABELS[plan.manager] }
        )}
      </p>
      <CommandBlock command={plan.command} />
      <Elevation plan={plan} />
      <div>
        <Button type="button" size="sm" onClick={onInstall}>
          {translate('auto.components.marketplace.GitInstall.install', 'Install')}
        </Button>
      </div>
    </div>
  )
}

function UnsupportedNotice({ manualCommand }: { manualCommand: string | null }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.GitInstall.unsupported',
          'MassOrca cannot install Git on this computer yet.'
        )}
      </p>
      {manualCommand ? (
        <>
          <p className="text-sm text-muted-foreground">
            {translate(
              'auto.components.marketplace.GitInstall.runYourself',
              'Run this command yourself:'
            )}
          </p>
          <CommandBlock command={manualCommand} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitInstall.useSystemPackages',
            "Install the git package with your system's package manager."
          )}
        </p>
      )}
    </div>
  )
}

function StepIcon({ status }: { status: GitInstallStepRow['status'] }): React.JSX.Element {
  switch (status) {
    case 'running':
      return <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-hidden />
    case 'done':
      return <CircleCheck className="size-4 text-foreground" aria-hidden />
    case 'failed':
      return <CircleX className="size-4 text-destructive" aria-hidden />
    case 'skipped':
      return <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
    case 'pending':
      return <Circle className="size-4 text-muted-foreground" aria-hidden />
  }
}

/** Git: installing. Live step list and log lines. */
export function GitInstallInstallingBoard({
  steps,
  log
}: {
  steps: GitInstallStepRow[]
  log: string[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Heading>
        {translate('auto.components.marketplace.GitInstall.installing', 'Installing Git…')}
      </Heading>
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <StepIcon status={step.status} />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      {log.length > 0 ? (
        <div className="max-h-40 scrollbar-sleek overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
          {log.map((line, index) => (
            <div key={`${index}-${line}`} className="break-all">
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Git: installed. Version, path and who installed it. */
export function GitInstallInstalledBoard({
  version,
  path
}: {
  version: string
  path: string
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitDetail.installed',
            'Git is installed on this computer.'
          )}
        </p>
        <Badge variant="secondary">
          {translate(
            'auto.components.marketplace.GitInstall.installedByMassOrca',
            'Installed by MassOrca'
          )}
        </Badge>
      </div>
      <GitFacts version={version} path={path} />
    </div>
  )
}

function GitFacts({ version, path }: { version: string | null; path: string }): React.JSX.Element {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {version ? (
        <>
          <dt className="text-muted-foreground">
            {translate('auto.components.marketplace.GitInstall.version', 'Version')}
          </dt>
          <dd className="font-mono">{version}</dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">
        {translate('auto.components.marketplace.GitInstall.location', 'Location')}
      </dt>
      <dd className="min-w-0 break-all font-mono">{path}</dd>
    </dl>
  )
}

/** Found, installed outside MassOrca: works or not, and who owns it. */
export function GitInstallOutsideBoard({
  health,
  version,
  path,
  owner,
  onAdopt
}: {
  health: 'works' | 'broken' | 'too-old'
  version: string | null
  path: string
  owner: GitOwner | null
  onAdopt: () => void
}): React.JSX.Element {
  const canManage = health === 'works' && owner !== null && owner !== 'unknown'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm">
          {health === 'works'
            ? translate(
                'auto.components.marketplace.GitInstall.foundWorks',
                'Found, installed outside MassOrca.'
              )
            : translate(
                'auto.components.marketplace.GitInstall.foundNotWorking',
                'Found, but not working.'
              )}
        </p>
        <Badge variant="outline">
          {health === 'works'
            ? translate('auto.components.marketplace.GitInstall.works', 'Works')
            : translate('auto.components.marketplace.GitInstall.notWorking', 'Not working')}
        </Badge>
      </div>
      {health === 'too-old' && version ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitInstall.tooOld',
            'Version {{version}} is older than MassOrca needs ({{minimum}}).',
            { version, minimum: GIT_MINIMUM_VERSION }
          )}
        </p>
      ) : null}
      <GitFacts version={health === 'broken' ? null : version} path={path} />
      {health === 'works' ? (
        <p className="text-xs text-muted-foreground">
          {owner && owner !== 'unknown'
            ? translate(
                'auto.components.marketplace.GitInstall.managedBy',
                'Managed by {{owner}}. MassOrca can take it over without reinstalling.',
                { owner: OWNER_LABELS[owner] }
              )
            : translate(
                'auto.components.marketplace.GitInstall.ownerUnknown',
                'Its installer is not known, so MassOrca would reinstall it.'
              )}
        </p>
      ) : null}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={onAdopt}>
          {canManage
            ? translate('auto.components.marketplace.GitInstall.manage', 'Manage with MassOrca')
            : translate(
                'auto.components.marketplace.GitInstall.reinstall',
                'Reinstall with MassOrca'
              )}
        </Button>
      </div>
    </div>
  )
}

function failureCopy(reason: GitInstallFailureReason): { key: string; fallback: string } {
  switch (reason) {
    case 'needs-password':
      return {
        key: 'auto.components.marketplace.GitInstall.failNeedsPassword',
        fallback:
          'This install needs an administrator password, which MassOrca does not ask for. Run the command below yourself.'
      }
    case 'installer-opened':
      return {
        key: 'auto.components.marketplace.GitInstall.failInstallerOpened',
        fallback:
          "Apple's Command Line Tools window opened. Finish it, then come back to this page."
      }
    case 'verify-failed':
      return {
        key: 'auto.components.marketplace.GitInstall.failVerify',
        fallback:
          'The install finished, but Git was not found afterwards. Run the command below yourself to see what happened.'
      }
    case 'too-old':
      return {
        key: 'auto.components.marketplace.GitInstall.failTooOld',
        fallback: `Git was installed, but this version is older than MassOrca needs (${GIT_MINIMUM_VERSION}).`
      }
    case 'unsupported':
      return {
        key: 'auto.components.marketplace.GitInstall.failUnsupported',
        fallback: 'MassOrca cannot install Git on this computer yet.'
      }
    case 'busy':
      return {
        key: 'auto.components.marketplace.GitInstall.failBusy',
        fallback: 'An install is already running.'
      }
    case 'step-failed':
      return {
        key: 'auto.components.marketplace.GitInstall.failStep',
        fallback:
          'The installer stopped with an error. Run the command below yourself to see the full message.'
      }
  }
}

/** Git: install failed. A plain reason, the exact manual command with Copy, and a re-check when the window returns. */
export function GitInstallFailedBoard({
  reason,
  manualCommand
}: {
  reason: GitInstallFailureReason
  manualCommand: string | null
}): React.JSX.Element {
  const copy = failureCopy(reason)
  return (
    <div className="flex flex-col gap-3">
      <Heading>
        {translate(
          'auto.components.marketplace.GitInstall.failedTitle',
          'Git could not be installed.'
        )}
      </Heading>
      <p className="text-sm">{translate(copy.key, copy.fallback)}</p>
      {manualCommand ? <CommandBlock command={manualCommand} /> : null}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitInstall.recheckNote',
          'This page checks again when you come back to it.'
        )}
      </p>
    </div>
  )
}

/** Could not check Git: never reported as missing. */
export function GitInstallUnverifiableBoard({
  onCheckAgain
}: {
  onCheckAgain: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitDetail.unknown',
          'Could not check Git on this computer.'
        )}
      </p>
      <div>
        <Button type="button" size="sm" variant="outline" onClick={onCheckAgain}>
          {translate('auto.components.marketplace.GitInstall.checkAgain', 'Check again')}
        </Button>
      </div>
    </div>
  )
}
