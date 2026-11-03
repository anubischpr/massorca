import { describe, expect, it } from 'vitest'
import {
  removeBotTeamMentionBeforeCaret,
  splitBotTeamMentionText,
  type BotTeamMentionName
} from './bot-team-mention-text'

const NAMES: BotTeamMentionName[] = [
  { name: 'Iris', kind: 'bot' },
  { name: 'Ana', kind: 'bot' },
  { name: 'Ana Lopez', kind: 'bot' },
  { name: 'Marketing', kind: 'team' }
]

describe('splitBotTeamMentionText', () => {
  it('splits known @names out of plain text, keeping the typed spelling', () => {
    expect(splitBotTeamMentionText('Hola @iris, mira esto', NAMES)).toEqual([
      { kind: 'text', value: 'Hola ' },
      { kind: 'mention', value: '@iris', name: 'Iris' },
      { kind: 'text', value: ', mira esto' }
    ])
  })

  it('prefers the longest name at the same position', () => {
    expect(splitBotTeamMentionText('@Ana Lopez revisa', NAMES)).toEqual([
      { kind: 'mention', value: '@Ana Lopez', name: 'Ana Lopez' },
      { kind: 'text', value: ' revisa' }
    ])
  })

  it('leaves unknown @words and mid-word @ as plain text', () => {
    expect(splitBotTeamMentionText('@Nadie y mail@Iris', NAMES)).toEqual([
      { kind: 'text', value: '@Nadie y mail@Iris' }
    ])
  })

  it('does not match a name that is only a prefix of a longer word', () => {
    expect(splitBotTeamMentionText('@Irisa', NAMES)).toEqual([{ kind: 'text', value: '@Irisa' }])
  })
})

describe('removeBotTeamMentionBeforeCaret', () => {
  it('removes a picked mention and its trailing space in one step', () => {
    expect(removeBotTeamMentionBeforeCaret('@Iris ', 6, NAMES)).toEqual({ text: '', caret: 0 })
  })

  it('keeps the words around the removed mention', () => {
    expect(removeBotTeamMentionBeforeCaret('Hola @Iris ', 11, NAMES)).toEqual({
      text: 'Hola ',
      caret: 5
    })
  })

  it('returns null when the caret is not right after a known mention', () => {
    expect(removeBotTeamMentionBeforeCaret('@Iris pide', 10, NAMES)).toBeNull()
    expect(removeBotTeamMentionBeforeCaret('@Nadie ', 7, NAMES)).toBeNull()
  })
})
