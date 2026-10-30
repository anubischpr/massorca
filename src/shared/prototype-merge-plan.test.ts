import { describe, expect, it } from 'vitest'
import {
  isPlanForRequest,
  chosenSelectorOf,
  keptMergeParts,
  mergeMarkOf,
  nextFreeDirectionLetter,
  parsePrototypeMergePlan,
  PROTOTYPE_MERGE_PLAN_MAX_BYTES,
  reviewPartsOf,
  type PrototypeMergePlan
} from './prototype-merge-plan'

const PLAN = {
  id: 'm1',
  from: ['A', 'C'],
  parts: [
    { name: 'Heading', selector: 'main > h1', from: 'A' },
    { name: 'Pay button', selector: 'button.cta', from: 'C' }
  ]
}

function parsed(plan: unknown = PLAN): PrototypeMergePlan {
  const result = parsePrototypeMergePlan(JSON.stringify(plan))
  if (result === null) {
    throw new Error('expected a valid plan')
  }
  return result
}

describe('parsePrototypeMergePlan', () => {
  it('reads a plan with its id, directions and parts', () => {
    expect(parsed()).toEqual(PLAN)
  })

  it('reads a plan that left the id out', () => {
    const { id: _id, ...withoutId } = PLAN
    expect(parsed(withoutId).id).toBeUndefined()
  })

  it('refuses text that is not JSON, not an object, or oversized', () => {
    expect(parsePrototypeMergePlan('not json')).toBeNull()
    expect(parsePrototypeMergePlan('[]')).toBeNull()
    expect(parsePrototypeMergePlan(' '.repeat(PROTOTYPE_MERGE_PLAN_MAX_BYTES + 1))).toBeNull()
  })

  it('refuses a plan that merges fewer than two directions or names one twice', () => {
    expect(parsePrototypeMergePlan(JSON.stringify({ ...PLAN, from: ['A'] }))).toBeNull()
    expect(parsePrototypeMergePlan(JSON.stringify({ ...PLAN, from: ['A', 'A'] }))).toBeNull()
  })

  it('refuses a part taken from a direction the plan does not merge', () => {
    const plan = { ...PLAN, parts: [{ name: 'Heading', selector: 'h1', from: 'B' }] }
    expect(parsePrototypeMergePlan(JSON.stringify(plan))).toBeNull()
  })

  it('refuses a plan with no parts, a blank name or selector, or a bad letter', () => {
    expect(parsePrototypeMergePlan(JSON.stringify({ ...PLAN, parts: [] }))).toBeNull()
    for (const part of [
      { name: '  ', selector: 'h1', from: 'A' },
      { name: 'Heading', selector: '', from: 'A' }
    ]) {
      expect(parsePrototypeMergePlan(JSON.stringify({ ...PLAN, parts: [part] }))).toBeNull()
    }
    expect(parsePrototypeMergePlan(JSON.stringify({ ...PLAN, from: ['A', 'cc'] }))).toBeNull()
  })
})

describe('isPlanForRequest', () => {
  const request = { letters: ['A', 'C'], planId: 'm1', baseline: null }

  it('takes a plan that carries the request id and merges the starred directions', () => {
    expect(isPlanForRequest(parsed(), '{"x":1}', request)).toBe(true)
  })

  it('refuses a plan with another id, even when the directions match', () => {
    expect(isPlanForRequest(parsed({ ...PLAN, id: 'old' }), '{}', request)).toBe(false)
  })

  it('refuses a plan for other directions', () => {
    const parts = [{ name: 'Heading', selector: 'main > h1', from: 'A' }]
    expect(isPlanForRequest(parsed({ ...PLAN, from: ['A', 'B'], parts }), '{}', request)).toBe(
      false
    )
    expect(isPlanForRequest(parsed({ ...PLAN, from: ['A', 'B', 'C'] }), '{}', request)).toBe(false)
  })

  it('takes the directions in any order', () => {
    expect(isPlanForRequest(parsed({ ...PLAN, from: ['C', 'A'] }), '{}', request)).toBe(true)
  })

  it('takes no plan while the request has no baseline yet, because the file is still being read', () => {
    expect(isPlanForRequest(parsed(), '{"x":1}', { letters: ['A', 'C'], planId: 'm1' })).toBe(false)
  })

  it('takes a plan without an id only when it differs from the file that was there before', () => {
    const { id: _id, ...withoutId } = PLAN
    const plan = parsed(withoutId)
    const text = JSON.stringify(withoutId)
    expect(isPlanForRequest(plan, text, { ...request, baseline: text })).toBe(false)
    expect(isPlanForRequest(plan, text, { ...request, baseline: '{}' })).toBe(true)
    expect(isPlanForRequest(plan, text, request)).toBe(true)
  })
})

describe('the review parts', () => {
  it('reads an old plan with one selector as sections that both directions can supply', () => {
    expect(reviewPartsOf(parsed())).toEqual([
      {
        id: 0,
        name: 'Heading',
        kind: 'section',
        selectors: { A: 'main > h1', C: 'main > h1' },
        selector: 'main > h1',
        suggested: 'A',
        from: 'A',
        on: true
      },
      {
        id: 1,
        name: 'Pay button',
        kind: 'section',
        selectors: { A: 'button.cta', C: 'button.cta' },
        selector: 'button.cta',
        suggested: 'C',
        from: 'C',
        on: true
      }
    ])
  })

  it('reads a part present in two directions, with its kind and one selector per direction', () => {
    const [part] = reviewPartsOf(
      parsed({
        ...PLAN,
        parts: [
          {
            name: 'Primary button',
            kind: 'component',
            selectors: { A: 'button.primary', C: '.cta-button' },
            from: 'C'
          }
        ]
      })
    )
    expect(part).toMatchObject({
      kind: 'component',
      selectors: { A: 'button.primary', C: '.cta-button' },
      from: 'C'
    })
    expect(part && chosenSelectorOf(part)).toBe('.cta-button')
    expect(part && mergeMarkOf(part)).toBe('suggested')
    expect(part && mergeMarkOf({ ...part, from: 'A' })).toBe('changed')
  })

  it('locks a part present in one direction to that source and marks it only in', () => {
    const [part] = reviewPartsOf(
      parsed({ ...PLAN, parts: [{ name: 'Timeline', selectors: { C: '.timeline' }, from: 'C' }] })
    )
    expect(part?.selectors).toEqual({ C: '.timeline' })
    expect(part && mergeMarkOf(part)).toBe('only in')
    expect(part && mergeMarkOf({ ...part, on: false })).toBe('left out')
  })

  it('refuses a part with no selector in the direction it comes from', () => {
    const plan = {
      ...PLAN,
      parts: [{ name: 'Timeline', selectors: { A: '.timeline' }, from: 'C' }]
    }
    expect(parsePrototypeMergePlan(JSON.stringify(plan))).toBeNull()
  })

  it('ignores selectors for a letter the plan does not merge', () => {
    const [part] = reviewPartsOf(
      parsed({
        ...PLAN,
        parts: [{ name: 'Hero', selectors: { A: '.hero', C: '#hero', Z: '#other' }, from: 'A' }]
      })
    )
    expect(part?.selectors).toEqual({ A: '.hero', C: '#hero' })
  })

  it('marks a part with no match in the preview as no preview while it is kept', () => {
    const [part] = reviewPartsOf(parsed())
    expect(part && mergeMarkOf(part, 'unmatched')).toBe('no preview')
    expect(part && mergeMarkOf({ ...part, on: false }, 'unmatched')).toBe('left out')
  })

  it('marks a part suggested, changed or left out', () => {
    const [heading] = reviewPartsOf(parsed())
    if (heading === undefined) {
      throw new Error('expected a part')
    }
    expect(mergeMarkOf(heading)).toBe('suggested')
    expect(mergeMarkOf({ ...heading, from: 'C' })).toBe('changed')
    expect(mergeMarkOf({ ...heading, from: 'C', on: false })).toBe('left out')
  })

  it('keeps only the parts that are on', () => {
    const [heading, button] = reviewPartsOf(parsed())
    if (heading === undefined || button === undefined) {
      throw new Error('expected two parts')
    }
    expect(keptMergeParts([heading, { ...button, on: false }])).toEqual([heading])
  })
})

describe('nextFreeDirectionLetter', () => {
  it('is the letter after the highest the set has', () => {
    expect(nextFreeDirectionLetter(['A', 'B', 'C'])).toBe('D')
    expect(nextFreeDirectionLetter(['A', 'C'])).toBe('D')
    expect(nextFreeDirectionLetter(['A', 'B', 'C', 'D'])).toBe('E')
  })

  it('takes the first gap when the set reaches Z, and is null when it is full', () => {
    expect(nextFreeDirectionLetter(['A', 'C', 'Z'])).toBe('B')
    expect(nextFreeDirectionLetter([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'])).toBeNull()
  })

  it('starts at A for an empty set', () => {
    expect(nextFreeDirectionLetter([])).toBe('A')
  })
})
