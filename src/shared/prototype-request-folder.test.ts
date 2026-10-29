import { describe, expect, it } from 'vitest'
import {
  createPrototypeRequestId,
  directionLetter,
  isPlainPathSegment,
  isPrototypePath,
  isRelativeFilePath,
  parsePrototypeFileName,
  prototypeFileName,
  prototypeRequestFolder
} from './prototype-request-folder'

// Returns the values in turn, then zero.
const sequence = (values: readonly number[]): (() => number) => {
  let next = 0
  return () => {
    const value = values[next] ?? 0
    next += 1
    return value
  }
}

describe('createPrototypeRequestId', () => {
  it('stamps the UTC time and adds a six-character suffix', () => {
    expect(
      createPrototypeRequestId(
        new Date('2026-10-28T20:15:00.000Z'),
        sequence([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
      )
    ).toBe('20261028-201500-ssssss')
  })

  it('pads the date and time fields', () => {
    expect(createPrototypeRequestId(new Date('2026-01-05T03:04:05Z'), () => 0)).toBe(
      '20260105-030405-aaaaaa'
    )
  })

  it('maps each random value onto the lowercase letters and digits, in order', () => {
    expect(
      createPrototypeRequestId(
        new Date('2026-10-28T20:15:00Z'),
        sequence([0, 0.999, 0.027, 1, 0.5, 0.2])
      )
    ).toBe('20261028-201500-a9a9sh')
  })

  it('sorts by time and stays filename-safe', () => {
    const earlier = createPrototypeRequestId(new Date('2026-10-28T09:05:00Z'), () => 0.9)
    const later = createPrototypeRequestId(new Date('2026-10-28T20:15:00Z'), () => 0.1)
    expect([later, earlier].sort()).toEqual([earlier, later])
    expect(later).toMatch(/^[a-z0-9-]+$/u)
  })

  it('gives the first character for a random value that is not a number in range', () => {
    const now = new Date('2026-10-28T20:15:00Z')
    expect(createPrototypeRequestId(now, () => Number.NaN)).toBe('20261028-201500-aaaaaa')
    expect(createPrototypeRequestId(now, () => -1)).toBe('20261028-201500-aaaaaa')
  })

  it('rejects an invalid time', () => {
    expect(() => createPrototypeRequestId(new Date(Number.NaN), () => 0)).toThrow(RangeError)
  })
})

describe('prototypeRequestFolder', () => {
  it('places a request under prototypes/', () => {
    expect(prototypeRequestFolder('20261028-201500-k3f9q2')).toBe(
      'prototypes/20261028-201500-k3f9q2'
    )
  })
})

describe('isPrototypePath', () => {
  it.each([
    'prototypes/20261028-201500-k3f9q2/A.html',
    'prototypes\\20261028-201500-k3f9q2\\B-v2.html',
    'prototypes/20261028-201500-k3f9q2'
  ])('takes %j as a prototype path', (path) => {
    expect(isPrototypePath(path)).toBe(true)
  })

  it.each([
    'prototypes',
    'prototypes/',
    'prototypes//A.html',
    'prototypes/../design/checkout/design.json',
    'prototypes-old/A.html',
    'visuals/prototypes/A.html',
    '/prototypes/A.html',
    'design/checkout/design.json'
  ])('does not take %j as a prototype path', (path) => {
    expect(isPrototypePath(path)).toBe(false)
  })
})

describe('path segments', () => {
  it.each(['A.html', '.hidden', 'bold'])('takes %j as a plain segment', (segment) => {
    expect(isPlainPathSegment(segment)).toBe(true)
  })

  it.each(['', '.', '..', 'a/b', 'a\\b'])('rejects %j as a plain segment', (segment) => {
    expect(isPlainPathSegment(segment)).toBe(false)
  })

  it.each(['minimal.html', 'bold/index.html'])('takes %j as a relative file path', (path) => {
    expect(isRelativeFilePath(path)).toBe(true)
  })

  it.each(['/minimal.html', '../minimal.html', 'bold//index.html', 'a\\b.html', ''])(
    'rejects %j as a relative file path',
    (path) => {
      expect(isRelativeFilePath(path)).toBe(false)
    }
  )
})

describe('direction files', () => {
  it('names directions A, B, C from index 0, and Z at 25', () => {
    expect([0, 1, 2, 25].map((index) => directionLetter(index))).toEqual(['A', 'B', 'C', 'Z'])
  })

  it('names the first version without a suffix and later versions with -vN', () => {
    expect(prototypeFileName('A', 1)).toBe('A.html')
    expect(prototypeFileName('B', 2)).toBe('B-v2.html')
    expect(prototypeFileName('B', 10)).toBe('B-v10.html')
  })

  it.each([
    ['A.html', { letter: 'A', version: 1 }],
    ['Z.html', { letter: 'Z', version: 1 }],
    ['B-v2.html', { letter: 'B', version: 2 }],
    ['B-v10.html', { letter: 'B', version: 10 }]
  ])('reads %j', (fileName, expected) => {
    expect(parsePrototypeFileName(fileName)).toEqual(expected)
  })

  it.each([
    'a.html',
    'AA.html',
    'B-v1.html',
    'B-v0.html',
    'B-v02.html',
    'B-v.html',
    'B-v2.htm',
    'B-v2-final.html',
    'B.png',
    'A.html.bak',
    'design/A.html',
    '../A.html',
    '',
    'B-v99999999999999999999.html'
  ])('reads %j as no direction file', (fileName) => {
    expect(parsePrototypeFileName(fileName)).toBeNull()
  })
})
