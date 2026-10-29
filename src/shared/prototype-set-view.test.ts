import { describe, expect, it } from 'vitest'
import type { PrototypeListedDirection } from './rpc-contract/prototype-params'
import { nextVersionOf } from './prototype-set-view'

function direction(letter: string, versions: number[]): PrototypeListedDirection {
  return {
    letter,
    versions: versions.map((version) => ({
      version,
      fileName: `${letter}-v${version}.html`,
      mtime: version
    }))
  }
}

describe('nextVersionOf', () => {
  it('starts a direction at v2 when it has no version yet', () => {
    expect(nextVersionOf([], 'A')).toBe(2)
    expect(nextVersionOf([direction('A', [])], 'A')).toBe(2)
  })

  it('writes one past the newest version', () => {
    expect(nextVersionOf([direction('A', [1])], 'A')).toBe(2)
    expect(nextVersionOf([direction('A', [1, 2])], 'A')).toBe(3)
  })

  it('compares version numbers, not the order they are listed in', () => {
    expect(nextVersionOf([direction('A', [3, 1, 2])], 'A')).toBe(4)
  })

  it('reads only the iterated direction', () => {
    expect(nextVersionOf([direction('A', [4]), direction('B', [1])], 'B')).toBe(2)
  })

  it('starts a letter the set does not list at v2', () => {
    expect(nextVersionOf([direction('A', [4])], 'C')).toBe(2)
  })
})
