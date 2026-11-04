import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { translate } from '@/i18n/i18n'
import { listBotTeams } from '@/runtime/runtime-bot-team-client'
import { foldSkillSearchText } from '../../../../shared/bot-team-skill-picker'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { SettingsSegmentedControl } from '../settings/SettingsFormControls'
import { MarketplaceCard, MarketplaceCardLabel, MarketplaceCardRow } from './MarketplaceDetail'
import { marketplaceSkillBots, marketplaceSkillTeams } from './MarketplaceSkillPageModel'

type AllBots = 'on' | 'off'

function botsText(count: number): string {
  return count === 1
    ? translate('auto.components.marketplace.MarketplaceSkillPage.usedByOne', 'Used by 1 bot')
    : translate('auto.components.marketplace.MarketplaceSkillPage.usedBy', 'Used by {{n}} bots', {
        n: count
      })
}

/** "Bot teams": which teams can use the skill, whether every bot there gets it, and who uses it now. */
export function MarketplaceSkillTeams({ skillName }: { skillName: string }): React.JSX.Element {
  const [teams, setTeams] = useState<BotTeam[] | null>(null)
  // Why: null follows the teams whose bots already use it until the person picks for themselves.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null)
  const [allBots, setAllBots] = useState<AllBots>('off')
  const [botsOpen, setBotsOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let current = true
    listBotTeams()
      .then((next) => {
        if (current) {
          setTeams(next)
        }
      })
      .catch((cause) => {
        console.warn('[marketplace] bot teams failed to load:', cause)
        if (current) {
          setTeams([])
        }
      })
    return () => {
      current = false
    }
  }, [])

  const rows = useMemo(() => marketplaceSkillTeams(teams ?? [], skillName), [skillName, teams])
  const selected = picked ?? new Set(rows.filter((row) => row.usesSkill).map((row) => row.id))
  const selectedTeams = (teams ?? []).filter((team) => selected.has(team.id))
  const bots =
    allBots === 'on'
      ? selectedTeams.flatMap((team) => team.bots.map((bot) => `${bot.name} · ${team.name}`))
      : marketplaceSkillBots(teams ?? [], skillName)
  const folded = foldSkillSearchText(query.trim())
  const shownBots = folded ? bots.filter((bot) => foldSkillSearchText(bot).includes(folded)) : bots

  const toggleTeam = (teamId: string, pressed: boolean): void => {
    const next = new Set(selected)
    if (pressed) {
      next.add(teamId)
    } else {
      next.delete(teamId)
    }
    setPicked(next)
  }

  return (
    <section data-marketplace-skill-teams>
      <MarketplaceCardLabel>
        {translate('auto.components.marketplace.MarketplaceSkillPage.botTeams', 'Bot teams')}
      </MarketplaceCardLabel>
      <MarketplaceCard>
        <div className="flex flex-col gap-2.5 px-4 py-3">
          <div>
            <span className="block text-sm font-medium">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.teams',
                'Teams that can use it'
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.teamsHelp',
                'Bots in these teams see it in their profile, under Skills.'
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rows.map((row) => (
              <Toggle
                key={row.id}
                variant="outline"
                size="sm"
                pressed={selected.has(row.id)}
                onPressedChange={(pressed) => toggleTeam(row.id, pressed)}
              >
                {row.name}
                <span className="text-muted-foreground">{row.botCount}</span>
              </Toggle>
            ))}
          </div>
        </div>
        <MarketplaceCardRow
          name={translate(
            'auto.components.marketplace.MarketplaceSkillPage.allBots',
            'Turn it on for every bot in these teams'
          )}
          description={translate(
            'auto.components.marketplace.MarketplaceSkillPage.allBotsHelp',
            'Off: each bot chooses it in its own profile.'
          )}
        >
          <SettingsSegmentedControl<AllBots>
            value={allBots}
            size="sm"
            ariaLabel={translate(
              'auto.components.marketplace.MarketplaceSkillPage.allBots',
              'Turn it on for every bot in these teams'
            )}
            onChange={setAllBots}
            options={[
              {
                value: 'on',
                label: translate('auto.components.marketplace.MarketplaceAgentPage.on', 'On')
              },
              {
                value: 'off',
                label: translate('auto.components.marketplace.MarketplaceAgentPage.off', 'Off')
              }
            ]}
          />
        </MarketplaceCardRow>
        <MarketplaceCardRow
          name={botsText(bots.length)}
          description={translate(
            'auto.components.marketplace.MarketplaceSkillPage.usedByHelp',
            'Change one bot from its profile.'
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-expanded={botsOpen}
            onClick={() => setBotsOpen((open) => !open)}
          >
            {botsOpen
              ? translate('auto.components.marketplace.MarketplaceSkillPage.hide', 'Hide')
              : translate('auto.components.marketplace.MarketplaceSkillPage.seeWhich', 'See which')}
          </Button>
        </MarketplaceCardRow>
        {botsOpen ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            <label className="flex items-center gap-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={translate(
                  'auto.components.marketplace.MarketplaceSkillPage.findBot',
                  'Find a bot'
                )}
                aria-label={translate(
                  'auto.components.marketplace.MarketplaceSkillPage.findBot',
                  'Find a bot'
                )}
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {shownBots.map((bot) => (
                <Badge key={bot} variant="secondary">
                  {bot}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </MarketplaceCard>
    </section>
  )
}
