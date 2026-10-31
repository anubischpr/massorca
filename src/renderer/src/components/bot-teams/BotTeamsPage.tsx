import { useState } from 'react'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import {
  addBotToTeam,
  createBotTeam,
  deleteBotTeam,
  removeBotFromTeam
} from '@/runtime/runtime-bot-team-client'
import { botAgentLabel } from '../../../../shared/bot-team-character-art'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { AddBotDialog } from './AddBotDialog'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { NewBotTeamForm } from './NewBotTeamForm'
import { useBotTeams, type BotTeamsState } from './use-bot-teams'

function TeamDetail({
  team,
  applyChange,
  onBack
}: {
  team: BotTeam
  applyChange: BotTeamsState['applyChange']
  onBack: () => void
}): React.JSX.Element {
  const [addingBot, setAddingBot] = useState(false)
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
            aria-label={translate('components.botTeams.removeBot', 'Remove bot')}
            onClick={() => void applyChange(() => removeBotFromTeam(team.id, bot.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
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
              <span className="flex items-center gap-2 text-sm font-semibold">
                <BotTeamCharacterIcon character={team.character} size={20} />
                <span className="truncate">{team.name}</span>
              </span>
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
  const { teams, failed, reload, applyChange } = useBotTeams()
  const [creating, setCreating] = useState(false)
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)
  const openTeam = teams?.find((team) => team.id === openTeamId)

  return (
    <div className="scrollbar-sleek h-full overflow-y-auto">
      {teams === null ? (
        failed ? (
          <div className="flex flex-col items-start gap-2 p-6 text-sm text-muted-foreground">
            {translate('components.botTeams.loadFailed', 'Could not reach this host.')}
            <Button variant="outline" size="sm" onClick={reload}>
              {translate('components.botTeams.retry', 'Retry')}
            </Button>
          </div>
        ) : null
      ) : creating ? (
        <NewBotTeamForm
          usedCharacters={teams.map((team) => team.character)}
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            void applyChange(() => createBotTeam(input)).then((done) => {
              if (done) {
                setCreating(false)
              }
            })
          }}
        />
      ) : openTeam ? (
        <TeamDetail team={openTeam} applyChange={applyChange} onBack={() => setOpenTeamId(null)} />
      ) : (
        <TeamGrid teams={teams} onNew={() => setCreating(true)} onOpen={setOpenTeamId} />
      )}
    </div>
  )
}
