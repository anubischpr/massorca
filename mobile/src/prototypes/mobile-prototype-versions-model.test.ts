import { describe, expect, it } from 'vitest'
import type { PrototypeListedDirection } from '../../../src/shared/rpc-contract/prototype-params'
import { listedSet } from './mobile-prototype-sets.test-fixture'
import {
  canRestoreVersions,
  earlierVersionHeader,
  restoreLabelOf,
  versionRowsOf
} from './mobile-prototype-versions-model'

const oct28At = (hours: number, minutes: number): number =>
  new Date(2026, 9, 28, hours, minutes).getTime()

const direction: PrototypeListedDirection = {
  letter: 'B',
  versions: [
    { version: 2, fileName: 'prototypes/r/B.v2.html', mtime: oct28At(20, 15) },
    { version: 3, fileName: 'prototypes/r/B.v3.html', mtime: oct28At(21, 5) },
    { version: 1, fileName: 'prototypes/r/B.html', mtime: oct28At(19, 40) }
  ]
}

describe('versionRowsOf', () => {
  it('lists the versions newest first, the newest as the current one', () => {
    expect(versionRowsOf(direction)).toEqual([
      {
        version: 3,
        fileName: 'prototypes/r/B.v3.html',
        current: true,
        label: 'Current · v3',
        timeLabel: 'Oct 28, 21:05'
      },
      {
        version: 2,
        fileName: 'prototypes/r/B.v2.html',
        current: false,
        label: 'v2',
        timeLabel: 'Oct 28, 20:15'
      },
      {
        version: 1,
        fileName: 'prototypes/r/B.html',
        current: false,
        label: 'v1',
        timeLabel: 'Oct 28, 19:40'
      }
    ])
  })

  it('lists nothing for a direction the host lists with no version', () => {
    expect(versionRowsOf({ letter: 'C', versions: [] })).toEqual([])
    expect(versionRowsOf(undefined)).toEqual([])
  })
})

describe('canRestoreVersions', () => {
  it('offers restore on a Claude set when the host knows the method', () => {
    expect(canRestoreVersions(listedSet({ agent: 'claude' }), true)).toBe(true)
  })

  it('hides restore for an older host', () => {
    expect(canRestoreVersions(listedSet({ agent: 'claude' }), false)).toBe(false)
  })

  it('hides restore for a Gentle Shell set', () => {
    expect(canRestoreVersions(listedSet({ agent: 'gentle-shell' }), true)).toBe(false)
  })
})

describe('restoreLabelOf', () => {
  it('names the version a restore would make, one past the newest', () => {
    expect(restoreLabelOf(3)).toBe('Restore as v4')
  })
})

describe('earlierVersionHeader', () => {
  it('titles an earlier version by its direction letter and number, read-only', () => {
    expect(earlierVersionHeader('B', 2)).toEqual({
      title: 'B · v2',
      subtitle: 'Earlier version, read-only'
    })
  })
})
