import { describe, expect, it } from 'vitest'
import { keyedEntries } from './prototype-entry-keys'

describe('keyedEntries', () => {
  it('keeps keys unique when two entries read the same, without using the index', () => {
    const keyed = keyedEntries(['Badge', 'Toast', 'Badge'], (entry) => entry)
    expect(new Set(keyed.map((entry) => entry.key)).size).toBe(3)
    expect(keyed.map((entry) => entry.index)).toEqual([0, 1, 2])
  })
})
