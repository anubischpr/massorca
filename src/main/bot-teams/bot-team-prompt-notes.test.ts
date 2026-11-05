import { describe, expect, it } from 'vitest'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import {
  BOT_TEAM_HISTORY_SOURCES_NOTE,
  BOT_TEAM_ROOM_VOICE_NOTE,
  BOT_TEAM_UNIVERSAL_CAPABILITY_NOTE,
  botTeamRoomExcerpt
} from './bot-team-prompt-notes'

const BOTS = [{ id: 'iris', name: 'Iris' }]
const message = (n: number, text: string, authorBotId: string | null = null): BotTeamMessage => ({
  id: `m${n}`,
  teamId: 't',
  text,
  authorBotId,
  createdAt: n
})

describe('botTeamRoomExcerpt', () => {
  it('keeps the last 12 messages, oldest first, each cut short', () => {
    const messages = Array.from({ length: 15 }, (_, n) => message(n, `line ${n}`))
    const lines = botTeamRoomExcerpt(messages, BOTS)
    expect(lines).toHaveLength(12)
    expect(lines[0]).toBe('Person: line 3')
    expect(botTeamRoomExcerpt([message(1, 'x'.repeat(900), 'iris')], BOTS)[0].length).toBeLessThan(
      320
    )
  })

  it('names the bot that spoke', () => {
    expect(botTeamRoomExcerpt([message(1, 'Hecho', 'iris')], BOTS)).toEqual(['Iris: Hecho'])
  })
})

describe('the notes bots read', () => {
  it('name the real Engram tools and the OpenMetadata read server only', () => {
    expect(BOT_TEAM_HISTORY_SOURCES_NOTE).toContain('mcp__engram__mem_search')
    expect(BOT_TEAM_HISTORY_SOURCES_NOTE).toContain('mcp__engram__mem_context')
    expect(BOT_TEAM_HISTORY_SOURCES_NOTE).not.toContain('plugin_engram')
    expect(BOT_TEAM_HISTORY_SOURCES_NOTE).toContain('"openmetadata"')
    expect(BOT_TEAM_HISTORY_SOURCES_NOTE).toContain('never another OpenMetadata server')
  })

  it('say every bot can make option cards and artifacts, and speak in the first person', () => {
    expect(BOT_TEAM_UNIVERSAL_CAPABILITY_NOTE).toContain('option cards')
    expect(BOT_TEAM_ROOM_VOICE_NOTE).toContain('Yo tomaré')
    expect(BOT_TEAM_ROOM_VOICE_NOTE).toContain('Never describe internal hand-offs')
  })
})
