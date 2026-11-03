import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { isNativeChatSkillForAgent } from '@/components/native-chat/use-native-chat-skills'
import { translate } from '@/i18n/i18n'
import { botTeamHostTarget, currentBotTeamHost } from '@/runtime/bot-team-host'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import { useAppStore } from '@/store'
import { botAgentLabel } from '../../../../shared/bot-team-character-art'
import { arrangeBotSkills, filterBotSkills } from '../../../../shared/bot-team-skill-picker'
import type { BotDraftInput } from '../../../../shared/rpc-contract/bot-team-params'
import type { SkillDiscoveryResult } from '../../../../shared/skills'
import { useBotModelOptions } from './use-bot-model-options'

export type BotAdvancedValue = {
  modelMode: 'auto' | 'manual'
  model: string | null
  effort: string | null
  skills: string[]
}

function SkillsDialog({
  botName,
  agent,
  selected,
  onCancel,
  onSave
}: {
  botName: string
  agent: BotDraftInput['agent']
  selected: readonly string[]
  onCancel: () => void
  onSave: (skills: string[]) => void
}): React.JSX.Element {
  const [result, setResult] = useState<SkillDiscoveryResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [chosen, setChosen] = useState<string[]>([...selected])
  const [query, setQuery] = useState('')
  const openSkillsPage = useAppStore((state) => state.openSkillsPage)

  // The team's host owns its skills, so the list is that host's, not this computer's.
  useEffect(() => {
    let closed = false
    void discoverSkillsForRuntimeTarget(botTeamHostTarget(currentBotTeamHost())).then(
      (found) => !closed && setResult(found),
      () => !closed && setFailed(true)
    )
    return () => {
      closed = true
    }
  }, [])

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate('components.botTeams.skillsFor', 'Skills for {{name}}', {
              name: botName || translate('components.botTeams.thisBot', 'this bot')
            })}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'components.botTeams.skillsHelp',
              'Installed on this team’s host. The bot is asked to use the ones you check on each task.'
            )}
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="text-sm text-muted-foreground">
            {translate('components.botTeams.skillsFailed', 'Could not read this host’s skills.')}
          </p>
        ) : null}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate('components.botTeams.searchSkills', 'Search skills')}
          aria-label={translate('components.botTeams.searchSkills', 'Search skills')}
        />
        <div className="scrollbar-sleek flex max-h-72 flex-col gap-1 overflow-y-auto">
          {/* Ordered by the saved selection, so rows do not jump while boxes are ticked. */}
          {arrangeBotSkills(filterBotSkills(result?.skills ?? [], query), selected).map(
            ({ skill, source }) => {
              const usable = result !== null && isNativeChatSkillForAgent(agent, skill, result)
              return (
                <Label
                  key={skill.id}
                  className="flex items-start gap-3 rounded-md p-2 font-normal hover:bg-accent"
                >
                  <Checkbox
                    disabled={!usable}
                    checked={chosen.includes(skill.name)}
                    onCheckedChange={(checked) =>
                      setChosen((current) =>
                        checked === true
                          ? [...current, skill.name]
                          : current.filter((name) => name !== skill.name)
                      )
                    }
                  />
                  <span className="min-w-0 grow">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{skill.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {source === 'added'
                          ? translate('components.botTeams.skillSourceAdded', 'Added')
                          : source === 'marketplace'
                            ? translate('components.botTeams.skillSourceMarketplace', 'Marketplace')
                            : translate('components.botTeams.skillSourceInstalled', 'Installed')}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {usable
                        ? skill.description
                        : translate(
                            'components.botTeams.skillOtherAgent',
                            'Not installed for {{agent}}.',
                            { agent: botAgentLabel(agent) }
                          )}
                    </span>
                  </span>
                </Label>
              )
            }
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="mr-auto" onClick={openSkillsPage}>
            {translate('components.botTeams.installSkill', 'Install a skill')}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {translate('components.botTeams.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => onSave(chosen)}>
            {translate('components.botTeams.saveBot', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Closed by default: a person who never opens it gets a bot that simply works. */
export function BotAdvancedOptions({
  botName,
  agent,
  automaticSummary,
  value,
  onChange
}: {
  botName: string
  agent: BotDraftInput['agent']
  /** What the host already picked for this bot, when its agent and job have not changed. */
  automaticSummary: string | null
  value: BotAdvancedValue
  onChange: (next: BotAdvancedValue) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [choosingSkills, setChoosingSkills] = useState(false)
  const models = useBotModelOptions(agent)
  const model = models.find((entry) => entry.id === value.model)
  const manual = value.modelMode === 'manual' && models.length > 0

  const setModel = (id: string): void => {
    const efforts = models.find((entry) => entry.id === id)?.efforts ?? []
    const effort = efforts.some((entry) => entry.value === value.effort)
      ? value.effort
      : (efforts.at(-1)?.value ?? null)
    onChange({ ...value, modelMode: 'manual', model: id, effort })
  }

  const automaticLine =
    models.length === 0
      ? translate(
          'components.botTeams.agentDefaultModel',
          '{{agent}} uses its own default model.',
          {
            agent: botAgentLabel(agent)
          }
        )
      : manual
        ? translate('components.botTeams.manualModel', 'Each new task starts with your choice.')
        : automaticSummary
          ? translate('components.botTeams.automaticModel', 'Automatic: {{summary}}.', {
              summary: automaticSummary
            })
          : translate(
              'components.botTeams.automaticModelPending',
              'Picked for this job when you save.'
            )

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
        <div className="flex flex-col rounded-lg border border-border">
          <div className="flex items-center gap-3 p-3">
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {translate('components.botTeams.skills', 'Skills')}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {value.skills.join(', ') ||
                  translate('components.botTeams.noSkills', 'None chosen')}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setChoosingSkills(true)}>
              {translate('components.botTeams.choose', 'Choose')}
            </Button>
          </div>
          <div className="flex items-center gap-3 border-t border-border p-3">
            <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {translate('components.botTeams.modelAndEffort', 'Model and effort')}
              </div>
              <div className="text-xs text-muted-foreground">{automaticLine}</div>
            </div>
            {models.length > 0 ? (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={manual ? 'manual' : 'auto'}
                onValueChange={(next) => {
                  if (next === 'auto') {
                    onChange({ ...value, modelMode: 'auto', model: null, effort: null })
                  } else if (next === 'manual') {
                    setModel(value.model ?? models[0].id)
                  }
                }}
              >
                <ToggleGroupItem value="auto">
                  {translate('components.botTeams.automatic', 'Automatic')}
                </ToggleGroupItem>
                <ToggleGroupItem value="manual">
                  {translate('components.botTeams.choose', 'Choose')}
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
          </div>
          {manual ? (
            <div className="grid grid-cols-2 gap-3 border-t border-border p-3">
              <div className="flex flex-col gap-1.5">
                <Label>{translate('components.botTeams.model', 'Model')}</Label>
                <Select value={value.model ?? undefined} onValueChange={setModel}>
                  <SelectTrigger size="sm" aria-label="Model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {model && model.efforts.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <Label>{translate('components.botTeams.effort', 'Effort')}</Label>
                  <Select
                    value={value.effort ?? undefined}
                    onValueChange={(effort) => onChange({ ...value, effort })}
                  >
                    <SelectTrigger size="sm" aria-label="Effort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {model.efforts.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {choosingSkills ? (
        <SkillsDialog
          botName={botName}
          agent={agent}
          selected={value.skills}
          onCancel={() => setChoosingSkills(false)}
          onSave={(skills) => {
            onChange({ ...value, skills })
            setChoosingSkills(false)
          }}
        />
      ) : null}
    </div>
  )
}
