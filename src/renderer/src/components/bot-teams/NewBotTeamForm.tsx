import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import { botAgentLabel } from '../../../../shared/bot-team-character-art'
import {
  BOT_TEAM_CHARACTERS,
  type BotDraftInput,
  type BotTeamCreateInput
} from '../../../../shared/rpc-contract/bot-team-params'
import { AddBotDialog } from './AddBotDialog'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { firstUnusedBotTeamCharacter } from './bot-team-character-pick'

export function NewBotTeamForm({
  usedCharacters,
  onCancel,
  onCreate
}: {
  usedCharacters: readonly string[]
  onCancel: () => void
  onCreate: (input: BotTeamCreateInput) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [character, setCharacter] = useState(() => firstUnusedBotTeamCharacter(usedCharacters))
  const [workspacesEnabled, setWorkspacesEnabled] = useState(false)
  const [bots, setBots] = useState<BotDraftInput[]>([])
  const [addingBot, setAddingBot] = useState(false)
  const trimmedName = name.trim()

  const nextCharacter = (): void => {
    const index = BOT_TEAM_CHARACTERS.indexOf(character)
    setCharacter(BOT_TEAM_CHARACTERS[(index + 1) % BOT_TEAM_CHARACTERS.length])
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">
        {translate('components.botTeams.newTeam', 'New team')}
      </h1>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-name">{translate('components.botTeams.teamName', 'Team name')}</Label>
        <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <BotTeamCharacterIcon character={character} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {translate('components.botTeams.teamCharacter', 'Team character')}
          </div>
          <div className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.teamCharacterHelp',
              'Identifies the team. Bots keep their own avatars.'
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={nextCharacter}>
          {translate('components.botTeams.change', 'Change')}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-purpose">
          {translate('components.botTeams.teamPurpose', 'What is this team for?')}
        </Label>
        <Textarea
          id="team-purpose"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{translate('components.botTeams.bots', 'Bots')}</h2>
          <Button variant="outline" size="sm" onClick={() => setAddingBot(true)}>
            <Plus className="size-3.5" />
            {translate('components.botTeams.addBot', 'Add a bot')}
          </Button>
        </div>
        {bots.map((bot) => (
          <div
            key={bot.name}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <AgentIcon agent={bot.agent} size={20} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{bot.name}</div>
              <div className="truncate text-xs text-muted-foreground">{bot.job}</div>
            </div>
            <span className="text-xs text-muted-foreground">{botAgentLabel(bot.agent)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {translate('components.botTeams.workspaces', 'Workspaces')}
          </div>
          <div className="text-xs text-muted-foreground">
            {translate(
              'components.botTeams.workspacesHelp',
              'Projects can connect to code and be followed in Workspaces.'
            )}
          </div>
        </div>
        <Switch
          aria-label={translate('components.botTeams.workspaces', 'Workspaces')}
          checked={workspacesEnabled}
          onCheckedChange={setWorkspacesEnabled}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {translate('components.botTeams.cancel', 'Cancel')}
        </Button>
        <Button
          disabled={trimmedName === ''}
          onClick={() =>
            onCreate({
              name: trimmedName,
              purpose: purpose.trim(),
              character,
              workspacesEnabled,
              bots
            })
          }
        >
          {translate('components.botTeams.createTeam', 'Create team')}
        </Button>
      </div>
      {addingBot ? (
        <AddBotDialog
          onCancel={() => setAddingBot(false)}
          onAdd={(bot) => {
            setBots((current) => [...current, bot])
            setAddingBot(false)
          }}
        />
      ) : null}
    </div>
  )
}
