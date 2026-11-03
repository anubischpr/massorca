import { describe, expect, it } from 'vitest'
import { briefEditorMarkdown, briefMarkdownFromLists } from './bot-team-project-brief-markdown'

describe('the project Brief as Markdown', () => {
  it('builds the three list sections with bullets for a project with no Markdown yet', () => {
    const brief = {
      requirements: ['Flyer for the offers', 'Offer email'],
      constraints: ['Prices are checked first'],
      decisions: []
    }
    expect(briefMarkdownFromLists(brief)).toBe(
      '## Requirements\n- Flyer for the offers\n- Offer email\n\n## Constraints\n- Prices are checked first\n\n## Decisions'
    )
    expect(briefEditorMarkdown(brief)).toBe(briefMarkdownFromLists(brief))
  })

  it('opens the editor on the saved Markdown when the project has one', () => {
    const brief = {
      requirements: ['Old'],
      constraints: [],
      decisions: [],
      markdown: '## Requirements\n- New'
    }
    expect(briefEditorMarkdown(brief)).toBe('## Requirements\n- New')
  })
})
