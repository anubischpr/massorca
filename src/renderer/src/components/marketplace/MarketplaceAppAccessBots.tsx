import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useBotTeams } from '@/components/bot-teams/use-bot-teams'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { MarketplaceBotAccess } from '../../../../shared/marketplace-apps'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import { withBotPicked, withTeamPicked } from './MarketplaceAppAccessEdit'

/** The bots and whole teams a limited app is picked for; a team's pick covers every bot in it. */
export function MarketplaceAppAccessBots({
  bots,
  disabled,
  onChange
}: {
  bots: MarketplaceBotAccess
  disabled: boolean
  onChange: (next: MarketplaceBotAccess) => void
}): React.JSX.Element {
  const { teams, failed } = useBotTeams()
  const [open, setOpen] = useState(false)
  if (teams === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {failed
          ? translate(
              'auto.components.marketplace.MarketplaceAppAccess.botsFailed',
              'Could not load Bot teams.'
            )
          : translate(
              'auto.components.marketplace.MarketplaceAppAccess.botsChecking',
              'Checking Bot teams…'
            )}
      </p>
    )
  }
  const wholeTeam = translate(
    'auto.components.marketplace.MarketplaceAppAccess.wholeTeam',
    'Whole team'
  )
  const unknown = translate(
    'auto.components.marketplace.MarketplaceAppAccess.notInBotTeams',
    'No longer in Bot teams'
  )
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {bots.teamIds.map((teamId) => {
          const team = teams.find((candidate) => candidate.id === teamId)
          return (
            <PickChip
              key={`team-${teamId}`}
              label={team?.name ?? unknown}
              detail={team ? wholeTeam : null}
              disabled={disabled}
              onRemove={() => onChange(withTeamPicked(bots, teamId, false))}
            />
          )
        })}
        {bots.botIds.map((botId) => {
          const found = findBot(teams, botId)
          return (
            <PickChip
              key={`bot-${botId}`}
              label={found?.bot.name ?? unknown}
              detail={found?.team.name ?? null}
              disabled={disabled}
              onRemove={() => onChange(withBotPicked(bots, botId, false))}
            />
          )
        })}
      </ul>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={disabled}
          >
            <Plus />
            {translate(
              'auto.components.marketplace.MarketplaceAppAccess.addBot',
              'Add a bot or team'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <Command>
            <CommandInput
              placeholder={translate(
                'auto.components.marketplace.MarketplaceAppAccess.search',
                'Search bots and teams'
              )}
            />
            <CommandList>
              <CommandEmpty>
                {translate(
                  'auto.components.marketplace.MarketplaceAppAccess.noneFound',
                  'No bots or teams found.'
                )}
              </CommandEmpty>
              {teams.map((team) => {
                const teamPicked = bots.teamIds.includes(team.id)
                return (
                  <CommandGroup key={team.id} heading={team.name}>
                    <PickItem
                      value={`team ${team.id} ${team.name}`}
                      label={wholeTeam}
                      picked={teamPicked}
                      onSelect={() => onChange(withTeamPicked(bots, team.id, !teamPicked))}
                    />
                    {team.bots.map((bot) => {
                      const botPicked = bots.botIds.includes(bot.id)
                      return (
                        <PickItem
                          key={bot.id}
                          value={`bot ${bot.id} ${bot.name} ${team.name}`}
                          label={bot.name}
                          picked={botPicked}
                          onSelect={() => onChange(withBotPicked(bots, bot.id, !botPicked))}
                        />
                      )
                    })}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function findBot(
  teams: readonly BotTeam[],
  botId: string
): { bot: BotTeamBot; team: BotTeam } | undefined {
  for (const team of teams) {
    const bot = team.bots.find((candidate) => candidate.id === botId)
    if (bot) {
      return { bot, team }
    }
  }
  return undefined
}

function PickChip({
  label,
  detail,
  disabled,
  onRemove
}: {
  label: string
  detail: string | null
  disabled: boolean
  onRemove: () => void
}): React.JSX.Element {
  return (
    <li className="inline-flex items-center gap-1">
      <Badge variant="outline">
        <span className="max-w-40 truncate">{label}</span>
        {detail ? <span className="text-muted-foreground">· {detail}</span> : null}
      </Badge>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate(
          'auto.components.marketplace.MarketplaceAppAccess.remove',
          'Remove {{name}}',
          { name: label }
        )}
        disabled={disabled}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  )
}

function PickItem({
  value,
  label,
  picked,
  onSelect
}: {
  value: string
  label: string
  picked: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <CommandItem value={value} onSelect={onSelect}>
      <Check className={cn('size-3.5', picked ? 'opacity-100' : 'opacity-0')} />
      <span className="truncate">{label}</span>
    </CommandItem>
  )
}
