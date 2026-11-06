import { describe, expect, it } from 'vitest'
import type { BotTeamMessage } from '../../../../shared/rpc-contract/bot-team-room-params'
import {
  BOT_TEAM_RUN_GAP_MS,
  botTeamMessageContinuesRun,
  botTeamMessageRuns
} from './bot-team-message-run'

const MINUTE = 60_000
const START = 1_700_000_000_000

function message(id: string, patch: Partial<BotTeamMessage> = {}): BotTeamMessage {
  return { id, teamId: 't1', authorBotId: 'ana', text: 'Hola', createdAt: START, ...patch }
}

describe('botTeamMessageContinuesRun', () => {
  it('continues the run when the same bot writes again within the gap', () => {
    expect(
      botTeamMessageContinuesRun(message('a'), message('b', { createdAt: START + MINUTE }))
    ).toBe(true)
  })

  it('starts a run when the author changes', () => {
    expect(botTeamMessageContinuesRun(message('a'), message('b', { authorBotId: 'bea' }))).toBe(
      false
    )
  })

  it('keeps consecutive messages from the person in one run', () => {
    const person = { authorBotId: null }
    expect(botTeamMessageContinuesRun(message('a', person), message('b', person))).toBe(true)
  })

  it('continues the run with a files-only message from the same bot', () => {
    const files = [{ path: 'attachments/flyer.png', name: 'flyer.png' }]
    expect(
      botTeamMessageContinuesRun(message('a'), message('b', { text: '', attachments: files }))
    ).toBe(true)
  })

  it('keeps a pause of exactly the gap and starts a run after a longer one', () => {
    expect(
      botTeamMessageContinuesRun(
        message('a'),
        message('b', { createdAt: START + BOT_TEAM_RUN_GAP_MS })
      )
    ).toBe(true)
    expect(
      botTeamMessageContinuesRun(
        message('a'),
        message('b', { createdAt: START + BOT_TEAM_RUN_GAP_MS + 1 })
      )
    ).toBe(false)
  })

  it('starts a run when either message has no time', () => {
    expect(botTeamMessageContinuesRun(message('a', { createdAt: null }), message('b'))).toBe(false)
    expect(botTeamMessageContinuesRun(message('a'), message('b', { createdAt: undefined }))).toBe(
      false
    )
  })

  it("starts a run when another team's bot wrote the message", () => {
    expect(botTeamMessageContinuesRun(message('a'), message('b', { fromTeamId: 'wh' }))).toBe(false)
  })
})

describe('botTeamMessageRuns', () => {
  it('groups the room into runs by author and pause', () => {
    const runs = botTeamMessageRuns([
      message('a'),
      message('b', { createdAt: START + MINUTE }),
      message('c', { authorBotId: 'bea' }),
      message('d', { authorBotId: 'bea', createdAt: START + 20 * MINUTE })
    ])
    expect(runs.map((run) => run.map((entry) => entry.id))).toEqual([['a', 'b'], ['c'], ['d']])
  })

  it('ends a run after a message that has rows under it', () => {
    const runs = botTeamMessageRuns([message('a'), message('b')], (entry) => entry.id === 'a')
    expect(runs.map((run) => run.map((entry) => entry.id))).toEqual([['a'], ['b']])
  })

  it('returns no runs for an empty room', () => {
    expect(botTeamMessageRuns([])).toEqual([])
  })
})
