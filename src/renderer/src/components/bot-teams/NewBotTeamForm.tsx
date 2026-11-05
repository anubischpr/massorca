import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { MarketplaceTeamAccessDialog } from '@/components/marketplace/MarketplaceTeamAccessDialog'
import { translate } from '@/i18n/i18n'
import { botAgentLabel } from '../../../../shared/bot-team-character-art'
import {
  BOT_TEAM_CHARACTERS,
  type BotDraftInput,
  type BotTeam,
  type BotTeamCreateInput,
  type BotTeamUpdateInput
} from '../../../../shared/rpc-contract/bot-team-params'
import { AddBotDialog } from './AddBotDialog'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { BotTeamHostField } from './BotTeamHostPicker'
import { firstUnusedBotTeamCharacter } from './bot-team-character-pick'
import { BotAgentIcon } from './BotAgentIcon'
import type { BotTeamChangeResult } from './use-bot-teams'

export function NewBotTeamForm({
  usedCharacters,
  editing,
  onCancel,
  onCreate
}: {
  usedCharacters: readonly string[]
  /** The team being edited, with what changes it on the host; absent when creating one. */
  editing?: {
    team: BotTeam
    onSave: (
      input: Required<
        Pick<
          BotTeamUpdateInput,
          'name' | 'purpose' | 'character' | 'workspacesEnabled' | 'accessMode'
        >
      >
    ) => void
    onAddBot: (bot: BotDraftInput) => Promise<BotTeamChangeResult>
    onUpdateBot: (botId: string, bot: BotDraftInput) => Promise<BotTeamChangeResult>
    onRemoveBot: (botId: string) => void
    onDelete: () => void
  }
  onCancel: () => void
  onCreate: (input: BotTeamCreateInput) => void
}): React.JSX.Element {
  const team = editing?.team
  const [name, setName] = useState(team?.name ?? '')
  const [purpose, setPurpose] = useState(team?.purpose ?? '')
  const [character, setCharacter] = useState(
    () => team?.character ?? firstUnusedBotTeamCharacter(usedCharacters)
  )
  const [workspacesEnabled, setWorkspacesEnabled] = useState(team?.workspacesEnabled ?? false)
  const [accessMode, setAccessMode] = useState<BotTeam['accessMode']>(team?.accessMode ?? 'default')
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [draftBots, setBots] = useState<BotDraftInput[]>([])
  const bots: readonly BotDraftInput[] = team?.bots ?? draftBots
  const [addingBot, setAddingBot] = useState(false)
  const [editingBotIndex, setEditingBotIndex] = useState<number | null>(null)
  const [botRefusal, setBotRefusal] = useState<string | null>(null)
  const trimmedName = name.trim()

  const nextCharacter = (): void => {
    const index = BOT_TEAM_CHARACTERS.indexOf(character)
    setCharacter(BOT_TEAM_CHARACTERS[(index + 1) % BOT_TEAM_CHARACTERS.length])
  }

  // A refused agent switch keeps the bot editor open beside its agent picker; any other outcome closes it.
  const settleBotEditor = (result: BotTeamChangeResult, close: () => void): void => {
    if (!result.done && result.agentSwitch) {
      setBotRefusal(result.refusal)
      return
    }
    setBotRefusal(null)
    close()
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">
        {team
          ? translate('components.botTeams.editTeam', 'Edit team')
          : translate('components.botTeams.newTeam', 'New team')}
      </h1>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-name">{translate('components.botTeams.teamName', 'Team name')}</Label>
        <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <BotTeamCharacterIcon character={character} size={56} still />
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
      {team ? null : <BotTeamHostField />}
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
      {team ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {translate('components.botTeams.settings.access', 'Access')}
              </div>
              <div className="text-xs text-muted-foreground">
                {translate(
                  'components.botTeams.accessHelp',
                  'What this team can do without asking.'
                )}
              </div>
            </div>
            <Select
              value={accessMode}
              onValueChange={(next) =>
                setAccessMode(next === 'default' ? 'default' : 'full-access')
              }
            >
              <SelectTrigger
                size="sm"
                aria-label={translate('components.botTeams.settings.access', 'Access')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-access">
                  {translate('components.botTeams.settings.fullAccess', 'Full access')}
                </SelectItem>
                <SelectItem value="default">
                  {translate('components.botTeams.settings.askFirst', 'Ask first')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {translate(
                'components.botTeams.marketplaceAppsHelp',
                'Connected apps this team’s bots can use.'
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setMarketplaceOpen(true)}>
              {translate('components.botTeams.settings.marketplaceApps', 'Marketplace apps…')}
            </Button>
          </div>
        </>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{translate('components.botTeams.bots', 'Bots')}</h2>
          <Button variant="outline" size="sm" onClick={() => setAddingBot(true)}>
            <Plus className="size-3.5" />
            {translate('components.botTeams.addBot', 'Add a bot')}
          </Button>
        </div>
        {bots.map((bot, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <BotAgentIcon agent={bot.agent} size={20} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{bot.name}</div>
              <div className="truncate text-xs text-muted-foreground">{bot.job}</div>
            </div>
            <span className="text-xs text-muted-foreground">{botAgentLabel(bot.agent)}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={translate('components.botTeams.editBot', 'Edit bot')}
              onClick={() => setEditingBotIndex(index)}
            >
              <Pencil className="size-4" />
            </Button>
            {team ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={translate('components.botTeams.removeBot', 'Remove bot')}
                onClick={() => editing?.onRemoveBot(team.bots[index].id)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
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
        {editing ? (
          <Button variant="ghost" className="mr-auto" onClick={editing.onDelete}>
            <Trash2 className="size-3.5" />
            {translate('components.botTeams.deleteTeam', 'Delete team')}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onCancel}>
          {translate('components.botTeams.cancel', 'Cancel')}
        </Button>
        <Button
          disabled={trimmedName === ''}
          onClick={() =>
            editing
              ? editing.onSave({
                  name: trimmedName,
                  purpose: purpose.trim(),
                  character,
                  workspacesEnabled,
                  accessMode
                })
              : onCreate({
                  name: trimmedName,
                  purpose: purpose.trim(),
                  character,
                  workspacesEnabled,
                  bots: draftBots
                })
          }
        >
          {team
            ? translate('components.botTeams.saveBot', 'Save')
            : translate('components.botTeams.createTeam', 'Create team')}
        </Button>
      </div>
      {editingBotIndex !== null ? (
        <AddBotDialog
          initial={bots[editingBotIndex]}
          agentRefusal={botRefusal}
          onAgentChange={() => setBotRefusal(null)}
          onCancel={() => {
            setBotRefusal(null)
            setEditingBotIndex(null)
          }}
          onAdd={async (bot) => {
            if (editing && team) {
              const result = await editing.onUpdateBot(team.bots[editingBotIndex].id, bot)
              settleBotEditor(result, () => setEditingBotIndex(null))
              return
            }
            setBots((current) =>
              current.map((entry, index) => (index === editingBotIndex ? bot : entry))
            )
            setEditingBotIndex(null)
          }}
        />
      ) : null}
      {team ? (
        <MarketplaceTeamAccessDialog
          team={team}
          open={marketplaceOpen}
          onOpenChange={setMarketplaceOpen}
        />
      ) : null}
      {addingBot ? (
        <AddBotDialog
          agentRefusal={botRefusal}
          onAgentChange={() => setBotRefusal(null)}
          onCancel={() => {
            setBotRefusal(null)
            setAddingBot(false)
          }}
          onAdd={async (bot) => {
            if (editing) {
              const result = await editing.onAddBot(bot)
              settleBotEditor(result, () => setAddingBot(false))
              return
            }
            setBots((current) => [...current, bot])
            setAddingBot(false)
          }}
        />
      ) : null}
    </div>
  )
}
