import type { TuiAgent } from '../../../../shared/tui-agent'

export type CalendarView = 'day' | 'week' | 'month'

/** Half-open window of epoch milliseconds: from <= at < to. */
export type CalendarRange = { from: number; to: number }

export type CalendarFrequency =
  | 'once'
  | 'hourly'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'custom'

/** One scheduled run on the calendar, from a bot team routine or an Orca automation. */
export type CalendarRun = {
  id: string
  name: string
  at: number
  frequency: CalendarFrequency
  source: 'bot' | 'automation'
  botName?: string
  teamId?: string
  teamName?: string
  /** Automations only: the agent that runs it. */
  agentId?: TuiAgent
}
