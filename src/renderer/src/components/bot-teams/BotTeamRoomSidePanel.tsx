import { useState } from 'react'
import StatusIndicator from '@/components/sidebar/StatusIndicator'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotAgentIcon } from './BotAgentIcon'
import { botTeamTaskGlyph, botTeamTaskLabel } from './bot-team-task-status-display'

type SideFilter = 'Active' | 'Stopped' | 'Done'

const SIDE_FILTERS: readonly SideFilter[] = ['Active', 'Stopped', 'Done']

const SIDE_FILTER_TEST: Record<SideFilter, (status: BotTeamTaskStatus) => boolean> = {
  Active: (status) => status !== 'Done' && status !== 'Stopped',
  Stopped: (status) => status === 'Stopped',
  Done: (status) => status === 'Done'
}

/** The Tasks and Bots panel beside the Conference room. */
export function BotTeamRoomSidePanel({
  team,
  tasks,
  offline,
  statusOf,
  onOpenTask
}: {
  team: BotTeam
  tasks: BotTeamTask[]
  offline: boolean
  statusOf: (task: BotTeamTask) => BotTeamTaskStatus
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const [sideFilter, setSideFilter] = useState<SideFilter>('Active')
  const botOf = (botId: string | null) => team.bots.find((bot) => bot.id === botId)
  const sideTasks = tasks.filter((task) => SIDE_FILTER_TEST[sideFilter](statusOf(task)))
  return (
    <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
      <h2 className="px-4 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {translate('components.botTeams.tasks', 'Tasks')}
      </h2>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {SIDE_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={filter === sideFilter ? 'secondary' : 'outline'}
            size="xs"
            className="rounded-full"
            onClick={() => setSideFilter(filter)}
          >
            {filter} {tasks.filter((task) => SIDE_FILTER_TEST[filter](statusOf(task))).length}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {sideTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            disabled={offline || task.sessionId === null}
            onClick={() => onOpenTask(task.id)}
            className="flex w-full gap-2.5 rounded-lg p-2 text-left hover:bg-sidebar-accent"
          >
            <span className="mt-0.5 shrink-0">
              <BotAgentIcon agent={botOf(task.ownerBotId)?.agent} size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{task.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusIndicator status={botTeamTaskGlyph(statusOf(task))} showTooltip={false} />
                {botTeamTaskLabel(statusOf(task))}
              </span>
            </span>
          </button>
        ))}
        {sideTasks.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {`No ${sideFilter.toLowerCase()} tasks`}
          </p>
        ) : null}
      </div>
      <h2 className="px-4 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {translate('components.botTeams.bots', 'Bots')}
      </h2>
      <div className="flex flex-col gap-0.5 px-2 pb-3">
        {team.bots.map((bot) => {
          const own = tasks.find((task) => task.ownerBotId === bot.id && statusOf(task) !== 'Done')
          return (
            <div key={bot.id} className="flex gap-2.5 rounded-lg p-2">
              <span className="mt-0.5 shrink-0">
                <BotAgentIcon agent={bot.agent} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{bot.name}</span>
                <span className="block text-xs text-muted-foreground">{bot.job}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {own
                    ? translate('components.botTeams.ownsTask', 'Owns {{title}}', {
                        title: own.title
                      })
                    : translate('components.botTeams.notInTask', 'Not in a task')}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
