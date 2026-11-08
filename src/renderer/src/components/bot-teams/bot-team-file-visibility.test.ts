import { describe, expect, it } from 'vitest'
import { isBotTeamFileVisible } from './bot-team-file-visibility'

describe('the files of a team folder that Files lists', () => {
  it('hides tool and dot folders and dot files', () => {
    expect(isBotTeamFileVisible('.atl/skill-registry.md')).toBe(false)
    expect(isBotTeamFileVisible('.atl/.skill-registry.cache.json')).toBe(false)
    expect(isBotTeamFileVisible('.gitignore')).toBe(false)
    expect(isBotTeamFileVisible('.git/HEAD')).toBe(false)
    expect(isBotTeamFileVisible('app/node_modules/pkg/index.js')).toBe(false)
    expect(isBotTeamFileVisible('docs/.cache/index.json')).toBe(false)
  })

  it('hides a dot folder written with Windows separators', () => {
    expect(isBotTeamFileVisible('docs\\.atl\\notes.md')).toBe(false)
  })

  it('hides the design system a prototype writes, in either separator, but not a folder named like it', () => {
    expect(isBotTeamFileVisible('design/system/tokens.json')).toBe(false)
    expect(isBotTeamFileVisible('design\\system\\components.html')).toBe(false)
    expect(isBotTeamFileVisible('docs/design/system/notes.md')).toBe(true)
    expect(isBotTeamFileVisible('design/mockup.png')).toBe(true)
  })

  it('keeps the deliverables, the attachments and the brief drafts', () => {
    expect(isBotTeamFileVisible('docs/presentacion/nexuscare-features-deck.html')).toBe(true)
    expect(isBotTeamFileVisible('docs/infografia-nexuscare.pdf')).toBe(true)
    expect(isBotTeamFileVisible('docs/project-brief/nexuscare-project-brief-borrador.md')).toBe(
      true
    )
    expect(isBotTeamFileVisible('attachments/from-warehouse-box-count.xlsx')).toBe(true)
    expect(isBotTeamFileVisible('docs\\presentacion\\deck.html')).toBe(true)
  })
})
