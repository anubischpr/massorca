import { describe, expect, it } from 'vitest'
import { nextToggleReply, parseToggleRound } from './rpc-toggle-select-rounds'

const rows = (...checked: boolean[]): string[] => [
  ...checked.map((on, index) => `[${on ? 'x' : ' '}] option ${index}`),
  'Done'
]

describe('Gentle Shell toggle rounds', () => {
  it('reads a round and refuses a list that is not one', () => {
    expect(parseToggleRound(rows(false, true))).toEqual({
      labels: ['option 0', 'option 1'],
      checked: [false, true]
    })
    expect(parseToggleRound(['A', 'B', 'Done'])).toBeNull()
    expect(parseToggleRound(['[ ] A', '[ ] B'])).toBeNull()
    expect(parseToggleRound(['[ ] A', 'Done'])).toBeNull()
  })

  it('toggles the remaining picks, then finishes with Done', () => {
    const script = { title: 'Pick', ticked: new Set(['option 0']), remaining: ['option 2'] }
    expect(nextToggleReply(script, 'Pick', rows(true, false, false))).toEqual({
      value: '[ ] option 2',
      last: false
    })
    expect(nextToggleReply(script, 'Pick', rows(true, false, true))).toEqual({
      value: 'Done',
      last: true
    })
  })

  it.each([
    ['another question', 'Other', rows(true, false, false)],
    ['a fresh round with nothing ticked', 'Pick', rows(false, false, false)],
    ['a round whose ticks differ from the script', 'Pick', rows(false, true, false)]
  ])('does not answer %s', (_name, title, options) => {
    const script = { title: 'Pick', ticked: new Set(['option 0']), remaining: ['option 2'] }
    expect(nextToggleReply(script, title, options)).toBeNull()
  })
})
