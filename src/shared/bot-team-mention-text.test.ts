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

  it('reads a project as a name, and a file path only when asked', () => {
    const names = [...NAMES, { name: 'NexusCare', kind: 'project' as const }]
    expect(splitBotTeamMentionText('En @NexusCare usa @site/flyer.html.', names)).toEqual([
      { kind: 'text', value: 'En ' },
      { kind: 'mention', value: '@NexusCare', name: 'NexusCare' },
      { kind: 'text', value: ' usa @site/flyer.html.' }
    ])
    expect(
      splitBotTeamMentionText('En @NexusCare usa @site/flyer.html.', names, { files: true })
    ).toEqual([
      { kind: 'text', value: 'En ' },
      { kind: 'mention', value: '@NexusCare', name: 'NexusCare' },
      { kind: 'text', value: ' usa ' },
      { kind: 'file', value: '@site/flyer.html', path: 'site/flyer.html' },
      { kind: 'text', value: '.' }
    ])
  })

  it('finds files with no names known, and leaves words with no extension plain', () => {
    expect(splitBotTeamMentionText('@brief.md y @v1 y a@b.md', [], { files: true })).toEqual([
      { kind: 'file', value: '@brief.md', path: 'brief.md' },
      { kind: 'text', value: ' y @v1 y a@b.md' }
    ])
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
