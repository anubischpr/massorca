import { describe, expect, it } from 'vitest'
import { BOT_TEAM_CHARACTERS } from './rpc-contract/bot-team-params'
import {
  BOT_CHARACTER_MOTION,
  botCharacterEffect,
  pickBotCharacterMove
} from './bot-team-character-motion'

const BASE = { character: 'circle' as const, working: true, unreachable: false, animated: true }

describe('botCharacterEffect', () => {
  it('gives each character its own effect while working', () => {
    const effects = BOT_TEAM_CHARACTERS.map((character) =>
      botCharacterEffect({ ...BASE, character, size: 64 })
    )
    expect(new Set(effects).size).toBe(BOT_TEAM_CHARACTERS.length)
  })

  it('shows nothing when idle', () => {
    expect(botCharacterEffect({ ...BASE, working: false, size: 64 })).toBeNull()
  })

  it('claims nothing when contact is lost', () => {
    expect(botCharacterEffect({ ...BASE, unreachable: true, size: 64 })).toBeNull()
    expect(botCharacterEffect({ ...BASE, unreachable: true, animated: false, size: 64 })).toBeNull()
  })

  it('keeps a still aura with animations off and at small sizes', () => {
    expect(botCharacterEffect({ ...BASE, animated: false, size: 64 })).toBe('aura')
    expect(botCharacterEffect({ ...BASE, size: 16 })).toBe('aura')
  })
})

describe('pickBotCharacterMove', () => {
  it('never dozes while working', () => {
    for (const character of BOT_TEAM_CHARACTERS) {
      for (let i = 0; i < BOT_CHARACTER_MOTION[character].moves.length; i++) {
        expect(pickBotCharacterMove(character, true, i / 5)).not.toBe('doze')
      }
    }
  })

  it('stays in range at the top of the random interval', () => {
    expect(pickBotCharacterMove('blob', false, 0.999999)).toBe('blink')
  })
})
