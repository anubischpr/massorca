import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { translate } from '@/i18n/i18n'
import {
  listBotTeamLinkableWorkspaces,
  setBotTeamProjectWorkspace
} from '@/runtime/runtime-bot-team-client'
import type {
  BotTeamLinkableWorkspace,
  BotTeamProject,
  BotTeamProjectWorkspace
} from '../../../../shared/rpc-contract/bot-team-room-params'

const NO_WORKSPACE = 'none'

/** The workspaces the team's host offers; null while loading, 'unavailable' on an older host. */
export type WorkspaceListing = BotTeamLinkableWorkspace[] | 'unavailable' | null

/** Why: a team with Workspaces off is never asked, since the host would only refuse. */
export function useLinkableWorkspaces(teamId: string, enabled = true): WorkspaceListing {
  const [listing, setListing] = useState<WorkspaceListing>(null)
  useEffect(() => {
    if (!enabled) {
      return
    }
    let current = true
    void listBotTeamLinkableWorkspaces(teamId).then(
      (workspaces) => {
        if (current) {
          setListing(workspaces)
        }
      },
      () => {
        if (current) {
          setListing('unavailable')
        }
      }
    )
    return () => {
      current = false
    }
  }, [teamId, enabled])
  return enabled ? listing : null
}

/**
 * Advanced options for linking a project to a Workspaces project. Closed by default; it renders
 * nothing until the host has listed its workspaces, so an older host shows no section at all.
 */
export function WorkspacesAdvancedOptions({
  listing,
  value,
  onChange
}: {
  listing: WorkspaceListing
  value: BotTeamProjectWorkspace | null
  onChange: (next: BotTeamProjectWorkspace | null) => void | Promise<void>
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (!Array.isArray(listing)) {
    return null
  }
  // Why: a workspace that is gone keeps its stored name in the picker until it is changed.
  const options: BotTeamLinkableWorkspace[] = [
    ...listing,
    ...(value && !listing.some((entry) => entry.key === value.key)
      ? [{ ...value, kind: 'git' as const }]
      : [])
  ]
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {translate('components.botTeams.advancedOptions', 'Advanced options')}
      </Button>
      {open ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
          <Label>{translate('components.botTeams.workspacesProject', 'Workspaces project')}</Label>
          <Select
            value={value?.key ?? NO_WORKSPACE}
            onValueChange={(next) => {
              const chosen = options.find((entry) => entry.key === next)
              void onChange(chosen ? { key: chosen.key, name: chosen.name } : null)
            }}
          >
            <SelectTrigger size="sm" aria-label="Workspaces project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_WORKSPACE}>
                {translate('components.botTeams.none', 'None')}
              </SelectItem>
              {options.map((entry) => (
                <SelectItem key={entry.key} value={entry.key}>
                  <span className="flex items-center gap-2">
                    <RepoIconGlyph
                      repoIcon={entry.icon}
                      className="size-4 shrink-0"
                      iconClassName="size-3.5"
                    />
                    {entry.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {value
              ? translate('components.botTeams.runsIn', 'Tasks of this project run in {{name}}.', {
                  name: value.name
                })
              : translate(
                  'components.botTeams.runsInTeamFolder',
                  "Tasks run in the team's own folder."
                )}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export const HOST_CANNOT_LINK = (): string =>
  translate('components.botTeams.hostCannotLink', 'This host cannot link Workspaces projects yet.')

/** A connected project's Workspaces project, where it can be changed or cleared. */
export function ProjectWorkspaceLink({
  team,
  project,
  onChanged
}: {
  team: { id: string }
  project: BotTeamProject
  onChanged: () => void
}): React.JSX.Element | null {
  const listing = useLinkableWorkspaces(team.id)
  if (!Array.isArray(listing)) {
    return null
  }
  const linked = project.workspace ?? null
  const save = async (next: BotTeamProjectWorkspace | null): Promise<void> => {
    try {
      const done = await setBotTeamProjectWorkspace(project.id, next?.key ?? null)
      if (done === 'unavailable') {
        toast.error(HOST_CANNOT_LINK())
      } else {
        onChanged()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  return (
    <div className="flex flex-col gap-2 px-4 pt-2.5">
      <p className="text-xs text-muted-foreground">
        {linked
          ? translate('components.botTeams.linkedTo', 'Linked to {{name}}.', { name: linked.name })
          : translate('components.botTeams.notLinked', 'Not linked to a Workspaces project.')}
      </p>
      <WorkspacesAdvancedOptions listing={listing} value={linked} onChange={save} />
    </div>
  )
}
