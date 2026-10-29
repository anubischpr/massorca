import { describe, expect, it } from 'vitest'
import { mobilePrototypePromptLine } from './mobile-prototype-prompt-line'

describe('mobilePrototypePromptLine', () => {
  it('shows the line a request carries under "Always make"', () => {
    expect(mobilePrototypePromptLine({ mode: 'always', count: 3 })).toBe(
      'Produce 3 distinct design directions, each a self-contained HTML file, with a one-line tradeoff.'
    )
  })

  it('shows the singular line the agent receives for one direction', () => {
    expect(mobilePrototypePromptLine({ mode: 'always', count: 1 })).toBe(
      'Produce 1 design direction, as a self-contained HTML file, with a one-line tradeoff.'
    )
  })

  it('shows "[your pick]" while each request asks', () => {
    expect(mobilePrototypePromptLine({ mode: 'ask', count: 2 })).toBe(
      'Produce [your pick] distinct design directions, each a self-contained HTML file, with a one-line tradeoff.'
    )
  })
})
