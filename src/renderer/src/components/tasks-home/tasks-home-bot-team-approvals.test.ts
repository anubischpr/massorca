import { describe, expect, it } from 'vitest'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { deriveBotTeamApprovalRows } from './tasks-home-bot-team-approvals'

const team: BotTeam = {
  id: 'team-1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [{ id: 'bot-1', name: 'Iris', job: '', agent: 'claude' }]
}

function task(id: string, sessionId: string | null): BotTeamTask {
  return { id, teamId: 'team-1', title: `Task ${id}`, prompt: '', ownerBotId: 'bot-1', sessionId }
}

type Statuses = ReadonlyMap<string, Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>>

function statuses(entries: Record<string, 'attention' | 'idle' | 'working'>): Statuses {
  return new Map(
    Object.entries(entries).map(([sessionId, status]) => [sessionId, { status }] as const)
  )
}

describe('deriveBotTeamApprovalRows', () => {
  it('lists only started tasks whose bot waits for the person', () => {
    const rows = deriveBotTeamApprovalRows({
      teams: [team],
      tasksByTeamId: {
        'team-1': [task('a', 's-a'), task('b', 's-b'), task('c', null), task('d', 's-d')]
      },
      statuses: statuses({ 's-a': 'attention', 's-b': 'working', 's-d': 'idle' })
    })
    expect(rows).toEqual([
      { taskId: 'a', teamId: 'team-1', title: 'Task a', teamName: 'Marketing', botName: 'Iris' }
    ])
  })

  it('is empty before the host has answered for any team', () => {
    expect(
      deriveBotTeamApprovalRows({ teams: [team], tasksByTeamId: {}, statuses: statuses({}) })
    ).toEqual([])
  })
})
