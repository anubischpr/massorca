import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { setBotTeamProjectWorkspace } from '@/runtime/runtime-bot-team-client'
import { updateBotTeamProject } from '@/runtime/runtime-bot-team-project-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamProject,
  BotTeamProjectWorkspace
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { codeSourceLabel } from './BotTeamCodeSource'
import { BotTeamProjectTeamsField } from './BotTeamProjectTeamsField'
import {
  HOST_CANNOT_LINK,
  useLinkableWorkspaces,
  WorkspacesAdvancedOptions
} from './BotTeamProjectWorkspace'

const HOST_CANNOT_EDIT = (): string =>
  translate('components.botTeams.hostCannotEditProject', 'This host cannot edit projects yet.')

/** Edit project: name, goal, Teams and, for the owner team with Workspaces on, the code link. */
export function BotTeamProjectFormEdit({
  project,
  actingTeam,
  allTeams,
  onClose,
  onSaved
}: {
  project: BotTeamProject
  /** The team whose sidebar the project was opened from. */
  actingTeam: BotTeam
  allTeams: readonly BotTeam[]
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element | null {
  const owner = allTeams.find((team) => team.id === project.teamId)
  const [name, setName] = useState(project.name)
  const [goal, setGoal] = useState(project.goal)
  const [linkedTeamIds, setLinkedTeamIds] = useState<string[]>(project.linkedTeamIds ?? [])
  const [workspace, setWorkspace] = useState<BotTeamProjectWorkspace | null>(
    project.workspace ?? null
  )
  const [saving, setSaving] = useState(false)
  // The owner team's Workspaces setting and link apply to the project, whoever edits it.
  const codeEditable = owner?.workspacesEnabled === true && actingTeam.id === project.teamId
  const listing = useLinkableWorkspaces(project.teamId, codeEditable && project.codeSource !== null)
  if (!owner) {
    return null
  }
  const trimmedName = name.trim()

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = await updateBotTeamProject({
        projectId: project.id,
        teamId: actingTeam.id,
        name: trimmedName,
        goal: goal.trim(),
        linkedTeamIds
      })
      if (updated === 'unavailable') {
        toast.error(HOST_CANNOT_EDIT())
        return
      }
      if (
        codeEditable &&
        project.codeSource !== null &&
        workspace?.key !== project.workspace?.key
      ) {
        const linked = await setBotTeamProjectWorkspace(project.id, workspace?.key ?? null)
        if (linked === 'unavailable') {
          toast.error(HOST_CANNOT_LINK())
        }
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{translate('components.botTeams.editProject', 'Edit project')}</DialogTitle>
          <DialogDescription>
            {translate(
              'components.botTeams.newProjectHelp',
              'A project holds the why. Its tasks hold the how.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-project-name">
              {translate('components.botTeams.projectName', 'Name')}
            </Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-project-goal">
              {translate('components.botTeams.projectGoal', 'Goal')}
            </Label>
            <Textarea
              id="edit-project-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
          <BotTeamProjectTeamsField
            owner={owner}
            linkedTeamIds={linkedTeamIds}
            allTeams={allTeams}
            editing
            onChange={setLinkedTeamIds}
          />
          {codeEditable && project.codeSource !== null ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {translate('components.botTeams.connectedTo', 'Connected to code: {{source}}.', {
                  source: codeSourceLabel(project.codeSource)
                })}
              </p>
              {project.codeSource === 'repo' ? (
                <WorkspacesAdvancedOptions
                  listing={listing}
                  value={workspace}
                  onChange={setWorkspace}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {translate('components.botTeams.cancel', 'Cancel')}
          </Button>
          <Button disabled={trimmedName === '' || saving} onClick={() => void save()}>
            {translate('components.botTeams.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
