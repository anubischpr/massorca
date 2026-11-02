import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import type {
  BotTeamCodeSource,
  BotTeamProjectWorkspace
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { useLinkableWorkspaces, WorkspacesAdvancedOptions } from './BotTeamProjectWorkspace'

const CODE_SOURCES: BotTeamCodeSource[] = ['repo', 'folder']

export function codeSourceLabel(source: BotTeamCodeSource): string {
  return source === 'repo'
    ? translate('components.botTeams.sourceRepo', 'Existing repository')
    : translate('components.botTeams.sourceFolder', 'New folder with git')
}

function codeSourceHint(source: BotTeamCodeSource): string {
  return source === 'repo'
    ? translate(
        'components.botTeams.sourceRepoHint',
        'Connect code that already lives in one of your accounts.'
      )
    : translate(
        'components.botTeams.sourceFolderHint',
        'Start a new folder and set it up as a git project.'
      )
}

export function CodeSourcePick({
  value,
  onChange
}: {
  value: BotTeamCodeSource
  onChange: (source: BotTeamCodeSource) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{translate('components.botTeams.source', 'Source')}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        className="w-full"
        value={value}
        onValueChange={(next) => {
          const source = CODE_SOURCES.find((entry) => entry === next)
          if (source) {
            onChange(source)
          }
        }}
      >
        {CODE_SOURCES.map((source) => (
          <ToggleGroupItem key={source} value={source} className="flex-1">
            {codeSourceLabel(source)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">{codeSourceHint(value)}</p>
    </div>
  )
}

/** A project of a team with Workspaces on that is not connected to code yet. */
export function ConnectToCodeCard({
  teamId,
  onConnect
}: {
  teamId: string
  onConnect: (source: BotTeamCodeSource, workspace: BotTeamProjectWorkspace | null) => Promise<void>
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<BotTeamCodeSource>('repo')
  const [workspace, setWorkspace] = useState<BotTeamProjectWorkspace | null>(null)
  const listing = useLinkableWorkspaces(teamId)
  return (
    <div className="mx-4 mt-3 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {translate('components.botTeams.notConnected', 'Not connected to code')}
          </div>
          <div className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.notConnectedHelp',
              "Lets this project's tasks work on its code."
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((current) => !current)}>
          {translate('components.botTeams.connectToCode', 'Connect to code')}
        </Button>
      </div>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <CodeSourcePick value={source} onChange={setSource} />
          {source === 'repo' ? (
            <WorkspacesAdvancedOptions
              listing={listing}
              value={workspace}
              onChange={setWorkspace}
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {translate('components.botTeams.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => void onConnect(source, source === 'repo' ? workspace : null)}>
              {translate('components.botTeams.connect', 'Connect')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
