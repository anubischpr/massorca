import { describe, expect, it } from 'vitest'
import { createSetState, makeMain, openDirection } from '../../../src/shared/prototype-set-state'
import {
  directionCardLine,
  directionTag,
  mainFirst,
  mergeButtonLabel,
  starLabelFor
} from './mobile-prototype-directions-model'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const SET = listedSet()

function mainOnB() {
  return makeMain(openDirection(createSetState(['A', 'B', 'C']), 'B'))
}

describe('mainFirst', () => {
  it('puts the main first and keeps the others in their own order', () => {
    expect(mainFirst(SET.directions, 'B').map((direction) => direction.letter)).toEqual([
      'B',
      'A',
      'C'
    ])
    expect(mainFirst(SET.directions, 'A').map((direction) => direction.letter)).toEqual([
      'A',
      'B',
      'C'
    ])
  })

  it('lists every direction when the main is not among them', () => {
    expect(mainFirst(SET.directions, 'Z').map((direction) => direction.letter)).toEqual([
      'A',
      'B',
      'C'
    ])
  })
})

describe('directionTag', () => {
  it('tags the main, and every other direction read-only', () => {
    const state = mainOnB()
    expect(directionTag(state, 'B')).toBe('main')
    expect(directionTag(state, 'A')).toBe('read-only')
  })

  it('tags a former main that was merged from others with where it came from', () => {
    const state = { ...mainOnB(), mergedFrom: { A: ['X', 'Y'] } }
    expect(directionTag(state, 'A')).toBe('X + Y')
    expect(directionTag(state, 'B')).toBe('main')
  })
})

describe('the card line, the star label and the Merge label', () => {
  it('names the direction, then its tag', () => {
    const [first, , third] = SET.directions
    if (first === undefined || third === undefined) {
      throw new Error('the fixture has three directions')
    }
    expect(directionCardLine(first, 'read-only')).toBe('A · Single column · read-only')
    expect(directionCardLine(third, 'main')).toBe('C · main')
  })

  it('words the star by what a tap does', () => {
    expect(starLabelFor('A', false)).toBe('Star A for merge')
    expect(starLabelFor('A', true)).toBe('Unstar A for merge')
  })

  it('counts the stars in the Merge button, and shows no count with none', () => {
    expect(mergeButtonLabel(0)).toBe('Merge')
    expect(mergeButtonLabel(2)).toBe('Merge (2)')
  })
})
