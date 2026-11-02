import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { deleteBotTeamMemory, listBotTeamMemory } from '@/runtime/runtime-bot-team-memory-client'
import type { BotTeamMemoryEntry } from '../../../../shared/rpc-contract/bot-team-memory-params'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamFilesBar } from './BotTeamFilesBar'

const TEAM_TAB = 'team'

function sourceLine(entry: BotTeamMemoryEntry, botName: string | null): string {
  if (entry.source.kind === 'task') {
    return translate('components.botTeams.memoryFromTask', 'From the {{task}} task', {
      task: entry.source.taskTitle ?? ''
    })
  }
  return botName
    ? translate('components.botTeams.memoryToldBot', 'You told {{bot}}', { bot: botName })
    : translate('components.botTeams.memoryToldTeam', 'You told the team')
}

/** What the team and each bot remember, and the way to make them forget a line. */
export function BotTeamMemory({ team }: { team: BotTeam }): React.JSX.Element {
  const [lines, setLines] = useState<BotTeamMemoryEntry[] | 'unavailable' | null>(null)
  const [tab, setTab] = useState(TEAM_TAB)
  useEffect(() => {
    let closed = false
    void listBotTeamMemory(team.id).then(
      (listed) => !closed && setLines(listed),
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [team.id])

  const forget = async (entry: BotTeamMemoryEntry): Promise<void> => {
    try {
      await deleteBotTeamMemory(entry.id)
      setLines((current) =>
        Array.isArray(current) ? current.filter((line) => line.id !== entry.id) : current
      )
      toast.success(translate('components.botTeams.memoryDeleted', 'Deleted from memory'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const bot = team.bots.find((candidate) => candidate.id === tab) ?? null
  const shown = Array.isArray(lines) ? lines.filter((line) => line.botId === (bot?.id ?? null)) : []
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamFilesBar>{translate('components.botTeams.memory', 'Memory')}</BotTeamFilesBar>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <div className="flex flex-wrap gap-1.5">
            {[{ id: TEAM_TAB, name: translate('components.botTeams.memoryTeamTab', 'Team') }]
              .concat(team.bots.map((entry) => ({ id: entry.id, name: entry.name })))
              .map((entry) => (
                <Button
                  key={entry.id}
                  variant={entry.id === tab ? 'secondary' : 'outline'}
                  size="xs"
                  className="rounded-full"
                  onClick={() => setTab(entry.id)}
                >
                  {entry.name}
                </Button>
              ))}
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {bot
                ? translate('components.botTeams.memoryBotTitle', 'What {{bot}} remembers', {
                    bot: bot.name
                  })
                : translate('components.botTeams.memoryTeamTitle', 'What the team remembers')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {bot
                ? translate(
                    'components.botTeams.memoryBotHelp',
                    'Only {{bot}} uses this. Delete anything you want {{bot}} to forget.',
                    { bot: bot.name }
                  )
                : translate(
                    'components.botTeams.memoryTeamHelp',
                    'All bots in this team can use this. Delete anything you want them to forget.'
                  )}
            </p>
          </div>
          {lines === 'unavailable' ? (
            <p className="text-sm text-muted-foreground">
              {translate(
                'components.botTeams.memoryUnavailable',
                'This host cannot show what the team remembers yet.'
              )}
            </p>
          ) : lines === null ? null : (
            <div className="flex flex-col rounded-xl border border-border bg-card">
              {shown.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{line.text}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {sourceLine(line, bot?.name ?? null)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void forget(line)}>
                    <Trash2 className="size-3.5" />
                    {translate('components.botTeams.delete', 'Delete')}
                  </Button>
                </div>
              ))}
              {shown.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {translate('components.botTeams.memoryEmpty', 'Nothing remembered here.')}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
