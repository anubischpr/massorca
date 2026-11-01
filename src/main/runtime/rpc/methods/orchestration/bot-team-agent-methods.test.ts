import { describe, expect, it } from 'vitest'
import type { BotTeamTask } from '../../../../../shared/rpc-contract/bot-team-room-params'
import { requireBotTeamCallerTask } from './bot-team-agent-methods'

const TASK: BotTeamTask = {
  id: 'task',
  teamId: 'team',
  title: 'Flyer',
  prompt: '',
  ownerBotId: 'bot',
  sessionId: 'session-1'
}
const db = {
  findBotTeamTaskBySession: (sessionId: string) => (sessionId === 'session-1' ? TASK : null)
}

describe('requireBotTeamCallerTask', () => {
  it('finds the task the calling chat runs', () => {
    expect(requireBotTeamCallerTask(db, 'session-1')).toBe(TASK)
  })

  it('refuses a chat outside Bot teams and a caller with no chat', () => {
    expect(() => requireBotTeamCallerTask(db, 'other')).toThrow('Only a chat that runs')
    expect(() => requireBotTeamCallerTask(db, undefined)).toThrow('Only a chat that runs')
  })
})
