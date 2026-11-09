import { useState } from 'react'
import { Copy, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { copyMarketplaceText } from './marketplace-clipboard'
import {
  hostProgramConfirmText,
  hostProgramFailureText,
  hostProgramStatusFailureText,
  hostProgramMethodLabel,
  hostProgramName,
  hostProgramReinstallText
} from './marketplace-host-program-copy'
import { MarketplaceFormDialog } from './MarketplaceFormDialog'
import type { MarketplaceHostProgram } from './use-marketplace-host-program'

const COPY = 'auto.components.marketplace.MarketplaceHostProgram'

function Checking({
  part,
  name,
  host
}: {
  part: 'install' | 'uninstall'
  name: string
  host: string
}): React.JSX.Element {
  return (
    <p data-marketplace-note={part} className="text-sm text-muted-foreground">
      {translate(`${COPY}.checking`, 'Checking {{name}} on {{host}}…', { name, host })}
    </p>
  )
}

function Busy({ label }: { label: string }): React.JSX.Element {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  )
}

function CommandLine({ command }: { command: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 break-all rounded-md bg-muted px-2 py-1 text-xs">{command}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate(`${COPY}.copyCommand`, 'Copy command')}
        onClick={() => void copyMarketplaceText(command)}
      >
        <Copy className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}

/** What the last successful run removed or left, so a removal always names its path. */
function Notice({ program }: { program: MarketplaceHostProgram }): React.JSX.Element | null {
  return program.notice ? (
    <p role="status" className="text-sm text-muted-foreground">
      {program.notice}
    </p>
  ) : null
}

/** The error a failed run leaves, with the exact command to run by hand when the host gave one. */
function Failure({
  program,
  host
}: {
  program: MarketplaceHostProgram
  host: string
}): React.JSX.Element | null {
  if (program.phase.kind !== 'failed') {
    return null
  }
  const { failure } = program.phase
  return (
    <div role="alert" className="flex flex-col gap-2 text-sm">
      <p className="text-destructive">{hostProgramFailureText(failure, program.program, host)}</p>
      {failure.command ? <CommandLine command={failure.command} /> : null}
    </div>
  )
}

/** Install for the program on the picked host: hidden once it is there, with progress and a real error. */
export function MarketplaceHostProgramInstall({
  program,
  host
}: {
  program: MarketplaceHostProgram
  host: string
}): React.JSX.Element | null {
  const name = hostProgramName(program.program)
  const { status, phase } = program
  if (status === null) {
    return <Checking part="install" name={name} host={host} />
  }
  if (!status.ok) {
    return (
      <p data-marketplace-note="install" className="text-sm text-muted-foreground">
        {hostProgramStatusFailureText(status, program.program, host)}
      </p>
    )
  }
  if (status.installed) {
    return null
  }
  const running = phase.kind === 'running' && phase.action === 'install'
  return (
    <div data-marketplace-host-program="install" className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!status.canInstall || phase.kind === 'running'}
        onClick={() => void program.run('install')}
      >
        {translate(`${COPY}.install`, 'Install')}
      </Button>
      {running ? (
        <Busy
          label={translate(
            `${COPY}.installing`,
            'Installing {{name}} on {{host}}. This can take a few minutes.',
            { name, host }
          )}
        />
      ) : null}
      {!running && status.canInstall && status.installCommand ? (
        <p className="text-xs text-muted-foreground">
          {translate(`${COPY}.willRun`, 'MassOrca will run: {{command}}', {
            command: status.installCommand
          })}
        </p>
      ) : null}
      {!status.canInstall ? (
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <p>{status.note}</p>
          {status.installCommand ? <CommandLine command={status.installCommand} /> : null}
        </div>
      ) : null}
      <Failure program={program} host={host} />
    </div>
  )
}

/** Uninstall for the program on the picked host: asks first, says what stays, and reports a real error. */
export function MarketplaceHostProgramUninstall({
  program,
  host
}: {
  program: MarketplaceHostProgram
  host: string
}): React.JSX.Element {
  const [confirming, setConfirming] = useState<'uninstall' | 'reinstall' | null>(null)
  const name = hostProgramName(program.program)
  const { status, phase } = program
  if (status === null) {
    return <Checking part="uninstall" name={name} host={host} />
  }
  if (!status.ok) {
    return (
      <p data-marketplace-note="uninstall" className="text-sm text-muted-foreground">
        {hostProgramStatusFailureText(status, program.program, host)}
      </p>
    )
  }
  if (!status.installed) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Notice program={program} />
        <p data-marketplace-note="uninstall" className="text-sm text-muted-foreground">
          {translate(`${COPY}.notInstalled`, '{{name}} is not installed on {{host}}.', {
            name,
            host
          })}
        </p>
      </div>
    )
  }
  const running = phase.kind === 'running' && phase.action === 'uninstall'
  const reinstalling = phase.kind === 'running' && phase.action === 'reinstall'
  return (
    <div data-marketplace-host-program="uninstall" className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">
        {translate(
          `${COPY}.installedVia`,
          '{{name}} {{version}} on {{host}}, installed with {{method}}.',
          {
            name,
            version: status.version ?? '',
            host,
            method: hostProgramMethodLabel(status.method ?? 'unknown')
          }
        )}
      </p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={!status.canUninstall || phase.kind === 'running'}
        onClick={() => setConfirming('uninstall')}
      >
        {translate(`${COPY}.uninstall`, 'Uninstall')}
      </Button>
      {status.canReinstall ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={phase.kind === 'running'}
          onClick={() => setConfirming('reinstall')}
        >
          {translate(`${COPY}.reinstall`, 'Reinstall with MassOrca')}
        </Button>
      ) : null}
      {reinstalling ? (
        <Busy
          label={translate(`${COPY}.reinstalling`, 'Reinstalling {{name}} on {{host}}…', {
            name,
            host
          })}
        />
      ) : null}
      <Notice program={program} />
      {running ? (
        <Busy
          label={translate(`${COPY}.uninstalling`, 'Uninstalling {{name}} from {{host}}…', {
            name,
            host
          })}
        />
      ) : null}
      {!status.canUninstall && status.note ? (
        <p className="text-xs text-muted-foreground">{status.note}</p>
      ) : null}
      <Failure program={program} host={host} />
      {confirming ? (
        <MarketplaceFormDialog
          title={
            confirming === 'uninstall'
              ? translate(`${COPY}.confirmTitle`, 'Uninstall {{name}} from {{host}}?', {
                  name,
                  host
                })
              : translate(`${COPY}.reinstallTitle`, 'Reinstall {{name}} on {{host}}?', {
                  name,
                  host
                })
          }
          description={
            confirming === 'uninstall'
              ? hostProgramConfirmText(program.program, host, status.uninstallCommand)
              : hostProgramReinstallText(program.program, host, status.reinstallCommand)
          }
          submitLabel={
            confirming === 'uninstall'
              ? translate(`${COPY}.uninstall`, 'Uninstall')
              : translate(`${COPY}.reinstallSubmit`, 'Reinstall')
          }
          destructive={confirming === 'uninstall'}
          pending={false}
          error={null}
          onSubmit={() => {
            const action = confirming
            setConfirming(null)
            void program.run(action)
          }}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </div>
  )
}
