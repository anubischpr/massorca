import { Lock, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'

/** The Teams field of a project: the owner is fixed, the others can be added and taken off. */
export function BotTeamProjectTeamsField({
  owner,
  linkedTeamIds,
  allTeams,
  editing,
  onChange
}: {
  owner: BotTeam
  linkedTeamIds: readonly string[]
  allTeams: readonly BotTeam[]
  /** An existing project: the x unlinks, and the help says the project stays in the owner team. */
  editing: boolean
  onChange: (linkedTeamIds: string[]) => void
}): React.JSX.Element {
  const linked = linkedTeamIds.flatMap((id) => allTeams.find((team) => team.id === id) ?? [])
  const addable = allTeams.filter(
    (team) => team.id !== owner.id && !linkedTeamIds.includes(team.id)
  )
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{translate('components.botTeams.projectTeams', 'Teams')}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input p-1.5">
        <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
          <BotTeamCharacterIcon character={owner.character} size={16} />
          <span>
            {translate('components.botTeams.ownerTeamChip', '{{team}}, owner', {
              team: owner.name
            })}
          </span>
          <Lock
            className="size-3 text-muted-foreground"
            role="img"
            aria-label={translate(
              'components.botTeams.ownerCannotBeRemoved',
              'The owner team cannot be removed'
            )}
          />
        </span>
        {linked.map((team) => {
          const label = editing
            ? translate('components.botTeams.unlinkTeam', 'Unlink {{team}}', { team: team.name })
            : translate('components.botTeams.removeTeam', 'Remove {{team}}', { team: team.name })
          return (
            <span
              key={team.id}
              className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
            >
              <BotTeamCharacterIcon character={team.character} size={16} />
              <span>{team.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-4"
                aria-label={label}
                title={label}
                onClick={() => onChange(linkedTeamIds.filter((id) => id !== team.id))}
              >
                <X className="size-3" />
              </Button>
            </span>
          )
        })}
        {addable.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="text-muted-foreground">
                <Plus className="size-3" />
                {translate('components.botTeams.addTeam', 'Add team')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {addable.map((team) => (
                <DropdownMenuItem
                  key={team.id}
                  onSelect={() => onChange([...linkedTeamIds, team.id])}
                >
                  <BotTeamCharacterIcon character={team.character} size={16} />
                  {team.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {editing
          ? translate(
              'components.botTeams.projectTeamsHelpEdit',
              "Linked teams can work on this project's tasks. The x unlinks a team; the project stays in the owner team."
            )
          : translate(
              'components.botTeams.projectTeamsHelp',
              "Linked teams can work on this project's tasks."
            )}
      </p>
    </div>
  )
}
