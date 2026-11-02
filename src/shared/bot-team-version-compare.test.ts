import { describe, expect, it } from 'vitest'
import { compareBotTeamTexts } from './bot-team-version-compare'

describe('compareBotTeamTexts', () => {
  it('puts the current text on the left and the earlier text on the right', () => {
    const result = compareBotTeamTexts(
      '[month] offers\nAsk your sales contact\n[product]\n[photo new]\n',
      '[month] offers\n[product]\nValid until [date]\n[photo old]\n'
    )
    expect(result.rows).toEqual([
      { left: '[month] offers', right: '[month] offers', change: null, index: null },
      { left: 'Ask your sales contact', right: null, change: 'added', index: 0 },
      { left: '[product]', right: '[product]', change: null, index: null },
      { left: '[photo new]', right: 'Valid until [date]', change: 'changed', index: 1 },
      { left: null, right: '[photo old]', change: 'removed', index: 2 }
    ])
    expect(result.changes).toBe(3)
  })

  it('has no changes for the same text, whatever the line endings and the last newline', () => {
    const result = compareBotTeamTexts('one\r\ntwo\r\n', 'one\ntwo')
    expect(result.changes).toBe(0)
    expect(result.rows.map((row) => row.change)).toEqual([null, null])
  })

  it('keeps blank lines as lines', () => {
    const result = compareBotTeamTexts('a\n\nb\n', 'a\nb\n')
    expect(result.rows).toEqual([
      { left: 'a', right: 'a', change: null, index: null },
      { left: '', right: null, change: 'added', index: 0 },
      { left: 'b', right: 'b', change: null, index: null }
    ])
  })

  it('reads an empty side as all added or all removed', () => {
    expect(compareBotTeamTexts('a\nb', '').rows.map((row) => row.change)).toEqual([
      'added',
      'added'
    ])
    expect(compareBotTeamTexts('', 'a').rows).toEqual([
      { left: null, right: 'a', change: 'removed', index: 0 }
    ])
  })
})
