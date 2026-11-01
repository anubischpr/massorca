import { useState } from 'react'
import { ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import {
  addBotToTeam,
  createBotTeam,
  deleteBotTeam,
  removeBotFromTeam,
  updateBotOnTeam
} from '@/runtime/runtime-bot-team-client'
import { botAgentLabel } from '../../../../shared/bot-team-character-art'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { AddBotDialog } from './AddBotDialog'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { BotTeamHostPicker } from './BotTeamHostPicker'
import { BotTeamRoom } from './BotTeamRoom'
import { NewBotTeamForm } from './NewBotTeamForm'
import { useBotTeams, type BotTeamsState } from './use-bot-teams'

function TeamDetail({
  team,
  offline,
  applyChange,
  onBack
}: {
  team: BotTeam
  offline: boolean
  applyChange: BotTeamsState['applyChange']
  onBack: () => void
}): React.JSX.Element {
  const [addingBot, setAddingBot] = useState(false)
  const [editingBotId, setEditingBotId] = useState<string | null>(null)
  const editingBot = team.bots.find((bot) => bot.id === editingBotId)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  // A task's thread is a full chat, so it takes the page rather than the team's column.
  if (openTaskId !== null) {
    return (
      <BotTeamRoom
        team={team}
        openTaskId={openTaskId}
        onOpenTask={setOpenTaskId}
        offline={offline}
      />
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate('components.botTeams.back', 'Back')}
          onClick={onBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <BotTeamCharacterIcon character={team.character} size={28} />
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{team.name}</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate('components.botTeams.deleteTeam', 'Delete team')}
          onClick={() => {
            void applyChange(() => deleteBotTeam(team.id)).then((done) => done && onBack())
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {team.purpose ? <p className="text-sm text-muted-foreground">{team.purpose}</p> : null}
      <BotTeamRoom team={team} openTaskId={null} onOpenTask={setOpenTaskId} offline={offline} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{translate('components.botTeams.bots', 'Bots')}</h2>
        <Button variant="outline" size="sm" onClick={() => setAddingBot(true)}>
          <Plus className="size-3.5" />
          {translate('components.botTeams.addBot', 'Add a bot')}
        </Button>
      </div>
      {team.bots.map((bot) => (
        <div key={bot.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
          <AgentIcon agent={bot.agent} size={20} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{bot.name}</div>
            <div className="truncate text-xs text-muted-foreground">{bot.job}</div>
          </div>
          <span className="text-xs text-muted-foreground">{botAgentLabel(bot.agent)}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={translate('components.botTeams.editBot', 'Edit bot')}
            onClick={() => setEditingBotId(bot.id)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={translate('components.botTeams.removeBot', 'Remove bot')}
            onClick={() => void applyChange(() => removeBotFromTeam(team.id, bot.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {editingBot ? (
        <AddBotDialog
          initial={editingBot}
          onCancel={() => setEditingBotId(null)}
          onAdd={(bot) => {
            setEditingBotId(null)
            void applyChange(() => updateBotOnTeam(team.id, editingBot.id, bot))
          }}
        />
      ) : null}
      {addingBot ? (
        <AddBotDialog
          onCancel={() => setAddingBot(false)}
          onAdd={(bot) => {
            setAddingBot(false)
            void applyChange(() => addBotToTeam(team.id, bot))
          }}
        />
      ) : null}
    </div>
  )
}

/** Losing contact says nothing about the bots, which run on the host: they may still be working. */
function HostUnreachableNotice({
  lastSeenAt,
  onRetry
}: {
  lastSeenAt: number | null
  onRetry: () => void
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-6 pt-4 text-sm">
      <p className="min-w-0 flex-1 text-muted-foreground">
        {lastSeenAt === null
          ? translate(
              'components.botTeams.hostUnreachable',
              'Can’t reach this host. Its bots may still be working.'
            )
          : translate(
              'components.botTeams.hostUnreachableSince',
              'Can’t reach this host. Its bots may still be working. Last update at {{time}}.',
              {
                time: new Date(lastSeenAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }
            )}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {translate('components.botTeams.tryAgain', 'Try again')}
      </Button>
    </div>
  )
}

function TeamGrid({
  teams,
  onNew,
  onOpen
}: {
  teams: BotTeam[]
  onNew: () => void
  onOpen: (teamId: string) => void
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          {translate('components.botTeams.allTeams', 'All teams')}
        </h1>
        <Button variant="outline" size="sm" onClick={onNew}>
          <Plus className="size-3.5" />
          {translate('components.botTeams.newTeam', 'New team')}
        </Button>
      </div>
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'components.botTeams.empty',
            'No teams yet. Create one to give your bots a place to work.'
          )}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => onOpen(team.id)}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
            >
              <BotTeamCharacterIcon character={team.character} size={64} />
              <span className="truncate text-sm font-semibold">{team.name}</span>
              <span className="flex-1 text-xs text-muted-foreground">{team.purpose}</span>
              <span className="flex items-center gap-1">
                {team.bots.map((bot) => (
                  <AgentIcon key={bot.id} agent={bot.agent} size={16} />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BotTeamsPage(): React.JSX.Element {
  const { teams, failed, lastSeenAt, reload, applyChange } = useBotTeams()
  const [creating, setCreating] = useState(false)
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)
  const openTeam = teams?.find((team) => team.id === openTeamId)

  return (
    <div className="scrollbar-sleek h-full overflow-y-auto">
      {creating ? null : <BotTeamHostPicker />}
      {failed && !creating ? (
        <HostUnreachableNotice lastSeenAt={lastSeenAt} onRetry={reload} />
      ) : null}
      {/* Before the list: choosing another host in the form must not lose what was typed. */}
      {creating ? (
        <NewBotTeamForm
          usedCharacters={(teams ?? []).map((team) => team.character)}
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            void applyChange(() => createBotTeam(input)).then((done) => {
              if (done) {
                setCreating(false)
              }
            })
          }}
        />
      ) : teams === null ? null : openTeam ? (
        <TeamDetail
          team={openTeam}
          offline={failed}
          applyChange={applyChange}
          onBack={() => setOpenTeamId(null)}
        />
      ) : (
        <TeamGrid teams={teams} onNew={() => setCreating(true)} onOpen={setOpenTeamId} />
      )}
    </div>
  )
}
