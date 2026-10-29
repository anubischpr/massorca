import { describe, expect, it } from 'vitest'
import {
  buildGentleDesignSet,
  buildPrototypeSet,
  parsePrototypeRequestManifest,
  resolveGentleDesignSlug,
  type PrototypeRequestManifest
} from './prototype-sets'

const manifest: PrototypeRequestManifest = {
  version: 1,
  requestId: '20261028-201500-k3f9q2',
  agent: 'claude',
  sessionId: 'session-1',
  originalPrompt: 'Make 3 prototypes of the pricing page',
  count: 3,
  createdAt: '2026-10-28T20:15:00.000Z'
}

const gentleManifest: PrototypeRequestManifest = {
  ...manifest,
  agent: 'gentle-shell',
  originalPrompt: '/prototype pricing page'
}

const design = {
  title: 'Checkout',
  brief: 'Three ways to pay',
  artboards: [
    { file: 'minimal.html', title: 'Minimal', tradeoff: 'Fewest fields' },
    { file: 'bold/index.html', title: 'Bold', width: 1280, height: 800 }
  ]
}

describe('parsePrototypeRequestManifest', () => {
  it('keeps a valid version 1 manifest and drops unknown fields', () => {
    expect(parsePrototypeRequestManifest({ ...manifest, extra: 'x' })).toEqual(manifest)
  })

  it('keeps the Gentle Shell baseline list', () => {
    const withBaseline = { ...gentleManifest, gentleDesignBaseline: ['checkout'] }
    expect(parsePrototypeRequestManifest(withBaseline)).toEqual(withBaseline)
  })

  it.each([
    { label: 'a string', input: 'manifest' },
    { label: 'an array', input: [manifest] },
    { label: 'another version', input: { ...manifest, version: 2 } },
    { label: 'a request id with a slash', input: { ...manifest, requestId: '../x' } },
    { label: 'an unknown agent', input: { ...manifest, agent: 'cursor' } },
    { label: 'an empty session id', input: { ...manifest, sessionId: '' } },
    { label: 'a prompt that is not text', input: { ...manifest, originalPrompt: 3 } },
    { label: 'a count of 0', input: { ...manifest, count: 0 } },
    { label: 'a count of 5', input: { ...manifest, count: 5 } },
    { label: 'a fractional count', input: { ...manifest, count: 2.5 } },
    { label: 'a time without a zone', input: { ...manifest, createdAt: '2026-10-28T20:15:00' } },
    { label: 'a date without a time', input: { ...manifest, createdAt: '2026-10-28' } },
    {
      label: 'a baseline that is not a list of names',
      input: { ...gentleManifest, gentleDesignBaseline: [1] }
    }
  ])('rejects $label', ({ input }) => {
    expect(parsePrototypeRequestManifest(input)).toBeNull()
  })
})

describe('buildPrototypeSet', () => {
  it('reads the directions and versions of the folder, sorted by letter and version', () => {
    expect(
      buildPrototypeSet(manifest, ['B.html', 'A-v3.html', 'A.html', 'B-v2.html', 'A-v2.html'])
    ).toEqual({
      setId: '20261028-201500-k3f9q2',
      requestText: 'Make 3 prototypes of the pricing page',
      directions: [
        {
          letter: 'A',
          versions: [
            { version: 1, fileName: 'prototypes/20261028-201500-k3f9q2/A.html' },
            { version: 2, fileName: 'prototypes/20261028-201500-k3f9q2/A-v2.html' },
            { version: 3, fileName: 'prototypes/20261028-201500-k3f9q2/A-v3.html' }
          ]
        },
        {
          letter: 'B',
          versions: [
            { version: 1, fileName: 'prototypes/20261028-201500-k3f9q2/B.html' },
            { version: 2, fileName: 'prototypes/20261028-201500-k3f9q2/B-v2.html' }
          ]
        }
      ]
    })
  })

  it('ignores entries that are not direction files', () => {
    expect(
      buildPrototypeSet(manifest, [
        'request.json',
        'notes.md',
        'a.html',
        'C-v1.html',
        'C.png',
        'C.html'
      ]).directions
    ).toEqual([
      {
        letter: 'C',
        versions: [{ version: 1, fileName: 'prototypes/20261028-201500-k3f9q2/C.html' }]
      }
    ])
  })

  it('has no directions while the folder is still empty', () => {
    expect(buildPrototypeSet(manifest, []).directions).toEqual([])
  })
})

describe('buildGentleDesignSet', () => {
  it('makes one direction per artboard, in artboard order, at version 1', () => {
    expect(buildGentleDesignSet(gentleManifest, 'checkout', design)).toEqual({
      setId: '20261028-201500-k3f9q2',
      requestText: '/prototype pricing page',
      directions: [
        { letter: 'A', versions: [{ version: 1, fileName: 'design/checkout/minimal.html' }] },
        { letter: 'B', versions: [{ version: 1, fileName: 'design/checkout/bold/index.html' }] }
      ]
    })
  })

  it('needs a Gentle Shell request', () => {
    expect(buildGentleDesignSet(manifest, 'checkout', design)).toBeNull()
  })

  it.each(['../checkout', 'a/b', ''])('needs a plain folder name, not %j', (slug) => {
    expect(buildGentleDesignSet(gentleManifest, slug, design)).toBeNull()
  })

  it.each([
    { label: 'no artboards', input: { title: 'Checkout', brief: 'Pay' } },
    { label: 'an empty artboard list', input: { ...design, artboards: [] } },
    {
      label: 'an artboard without a title',
      input: { ...design, artboards: [{ file: 'a.html' }] }
    },
    {
      label: 'a file that climbs out of the folder',
      input: { ...design, artboards: [{ file: '../a.html', title: 'A' }] }
    },
    {
      label: 'an absolute file',
      input: { ...design, artboards: [{ file: '/a.html', title: 'A' }] }
    },
    {
      label: 'a backslash in a file',
      input: { ...design, artboards: [{ file: 'a\\b.html', title: 'A' }] }
    },
    {
      label: 'a zero width',
      input: { ...design, artboards: [{ file: 'a.html', title: 'A', width: 0 }] }
    },
    {
      label: 'a width that is text',
      input: { ...design, artboards: [{ file: 'a.html', title: 'A', width: '1280' }] }
    },
    {
      label: 'a tradeoff that is not text',
      input: { ...design, artboards: [{ file: 'a.html', title: 'A', tradeoff: 3 }] }
    },
    { label: 'no brief', input: { title: 'Checkout', artboards: design.artboards } },
    {
      label: 'more artboards than direction letters',
      input: {
        ...design,
        artboards: Array.from({ length: 27 }, (_, index) => ({
          file: `${index}.html`,
          title: `Option ${index}`
        }))
      }
    }
  ])('rejects a design with $label', ({ input }) => {
    expect(buildGentleDesignSet(gentleManifest, 'checkout', input)).toBeNull()
  })

  it('leaves out a malformed artboard and keeps the others in artboard order', () => {
    const set = buildGentleDesignSet(gentleManifest, 'checkout', {
      ...design,
      artboards: [
        { file: 'minimal.html', title: 'Minimal' },
        { file: '../escape.html', title: 'Escape' },
        { file: 'bold/index.html', title: 'Bold' }
      ]
    })
    expect(set?.directions).toEqual([
      { letter: 'A', versions: [{ version: 1, fileName: 'design/checkout/minimal.html' }] },
      { letter: 'B', versions: [{ version: 1, fileName: 'design/checkout/bold/index.html' }] }
    ])
  })

  it('keeps the first of two artboards that share a file', () => {
    const set = buildGentleDesignSet(gentleManifest, 'checkout', {
      ...design,
      artboards: [
        { file: 'a.html', title: 'A' },
        { file: 'a.html', title: 'B' }
      ]
    })
    expect(set?.directions).toEqual([
      { letter: 'A', versions: [{ version: 1, fileName: 'design/checkout/a.html' }] }
    ])
  })
})

describe('resolveGentleDesignSlug', () => {
  it.each([
    { label: 'one new folder', baseline: ['a'], current: ['a', 'b'], expected: 'b' },
    { label: 'the first folder ever', baseline: [], current: ['x'], expected: 'x' },
    { label: 'a new folder listed twice', baseline: ['a'], current: ['b', 'b'], expected: 'b' },
    { label: 'no new folder', baseline: ['a'], current: ['a'], expected: null },
    { label: 'two new folders', baseline: ['a'], current: ['a', 'b', 'c'], expected: null },
    { label: 'no folders at all', baseline: [], current: [], expected: null }
  ])('resolves $label', ({ baseline, current, expected }) => {
    expect(resolveGentleDesignSlug(baseline, current)).toBe(expected)
  })
})
