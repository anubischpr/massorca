import { describe, expect, it, vi } from 'vitest'
import { botTeamTaskGlyph, botTeamTaskLabel } from './bot-team-task-status-display'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

describe('the label and glyph of an unanswered status', () => {
  it('names it neutrally and never as Working', () => {
    expect(botTeamTaskLabel('Unknown')).toBe('Checking status')
    expect(botTeamTaskGlyph('Unknown')).toBe('inactive')
  })
})
