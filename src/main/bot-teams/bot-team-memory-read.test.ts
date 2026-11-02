import { describe, expect, it } from 'vitest'
import type { BotTeamMemoryEntry } from '../../shared/rpc-contract/bot-team-memory-params'
import { readBotTeamMemoryLines } from './bot-team-memory-read'

function line(id: string, botId: string | null, text: string): BotTeamMemoryEntry {
  return { id, teamId: 't', botId, text, source: { kind: 'person', taskTitle: null } }
}

describe('readBotTeamMemoryLines', () => {
  it('gives a bot the whole team memory and its own, never another bot', () => {
    const lines = readBotTeamMemoryLines(
      {
        listBotTeamMemory: () => [
          line('1', null, 'Team line'),
          line('2', 'iris', 'Iris line'),
          line('3', 'nora', 'Nora line')
        ]
      },
      't',
      'iris'
    )
    expect(lines).toEqual({ team: ['Team line'], bot: ['Iris line'] })
  })

  it('keeps only the newest lines of a long memory', () => {
    const many = Array.from({ length: 60 }, (_, i) => line(`${i}`, null, `line ${i}`))
    const lines = readBotTeamMemoryLines({ listBotTeamMemory: () => many }, 't', 'iris')
    expect(lines.team).toHaveLength(40)
    expect(lines.team.at(-1)).toBe('line 59')
    expect(lines.team[0]).toBe('line 20')
  })
})
