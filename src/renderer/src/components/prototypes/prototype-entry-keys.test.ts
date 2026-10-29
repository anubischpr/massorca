import { describe, expect, it } from 'vitest'
import { keyedEntries } from './prototype-entry-keys'

describe('keyedEntries', () => {
  it('keys each entry by its text, and tells two equal texts apart by how many came before', () => {
    const keyed = keyedEntries(['Toast', 'Modal', 'Toast'], (text) => text)
    expect(keyed.map((entry) => entry.key)).toEqual([
      'Toast\u00000',
      'Modal\u00000',
      'Toast\u00001'
    ])
  })

  it('keeps each entry with its position in the list', () => {
    const keyed = keyedEntries([{ path: 'a.css' }, { path: 'b.css' }], (source) => source.path)
    expect(keyed.map((entry) => [entry.entry.path, entry.index])).toEqual([
      ['a.css', 0],
      ['b.css', 1]
    ])
  })
})
