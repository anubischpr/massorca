import { describe, expect, it } from 'vitest'
import { prototypeTitle } from './prototype-list-model'

const LONG_CHAT_TITLE = 'Improve the opportunities impact explorer so every filter also updates the chart'
const PROMPT = 'Build an opportunities impact explorer with filters for owners and stages'

describe('prototypeTitle', () => {
  it('shows the AI title over the chat description and the prompt', () => {
    expect(
      prototypeTitle({
        title: 'Opportunities explorer',
        chatTitle: LONG_CHAT_TITLE,
        originalPrompt: PROMPT
      })
    ).toBe('Opportunities explorer')
  })

  it('keeps the chat title for a set that has no AI title yet', () => {
    expect(prototypeTitle({ chatTitle: 'Explorer chat', originalPrompt: PROMPT })).toBe(
      'Explorer chat'
    )
  })

  it('falls back to the first words of the prompt when there is no title at all', () => {
    expect(prototypeTitle({ chatTitle: null, originalPrompt: PROMPT })).toBe(
      'Build an opportunities impact explorer with'
    )
  })

  it('ignores a blank AI title', () => {
    expect(
      prototypeTitle({ title: '   ', chatTitle: 'Explorer chat', originalPrompt: PROMPT })
    ).toBe('Explorer chat')
  })
})
