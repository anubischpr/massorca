import { describe, expect, it } from 'vitest'
import {
  arrangeBotSkills,
  filterBotSkills,
  foldSkillSearchText,
  type BotSkillPickerSkill
} from './bot-team-skill-picker'

const SKILLS: BotSkillPickerSkill[] = [
  { name: 'marketing-copy', description: 'Write headlines and product copy', installed: true },
  { name: 'cafe-menu', description: 'Draft a menu for the Café downstairs', installed: true },
  { name: 'pdf-tools', description: 'Read and split PDF files', installed: true },
  { name: 'translate', description: 'Translate text between languages', installed: false },
  { name: 'calendar', description: 'Schedule events', installed: true, source: 'marketplace' }
]

describe('foldSkillSearchText', () => {
  it('drops accents and case so the search is accent- and case-insensitive', () => {
    expect(foldSkillSearchText('Café Ñandú')).toBe('cafe nandu')
  })
})

describe('filterBotSkills', () => {
  it('returns every skill for an empty or blank query', () => {
    expect(filterBotSkills(SKILLS, '  ')).toHaveLength(SKILLS.length)
  })

  it('finds a name with an accented character when the query has none', () => {
    expect(filterBotSkills(SKILLS, 'cafe').map((s) => s.name)).toEqual(['cafe-menu'])
  })

  it('matches the description, not only the name', () => {
    expect(filterBotSkills(SKILLS, 'PDF').map((s) => s.name)).toEqual(['pdf-tools'])
    expect(filterBotSkills(SKILLS, 'headlines').map((s) => s.name)).toEqual(['marketing-copy'])
  })

  it('requires every query word to match somewhere in the skill', () => {
    expect(filterBotSkills(SKILLS, 'menu downstairs').map((s) => s.name)).toEqual(['cafe-menu'])
    expect(filterBotSkills(SKILLS, 'menu pdf')).toEqual([])
  })
})

describe('arrangeBotSkills', () => {
  it('puts skills already added to this bot first, then installed, then the rest', () => {
    const arranged = arrangeBotSkills(SKILLS, ['pdf-tools'])
    expect(arranged.map((entry) => [entry.skill.name, entry.source])).toEqual([
      ['pdf-tools', 'added'],
      ['marketing-copy', 'installed'],
      ['cafe-menu', 'installed'],
      ['translate', 'marketplace'],
      ['calendar', 'marketplace']
    ])
  })

  it('keeps the host order inside each group', () => {
    const names = arrangeBotSkills(SKILLS, []).map((entry) => entry.skill.name)
    expect(names).toEqual(['marketing-copy', 'cafe-menu', 'pdf-tools', 'translate', 'calendar'])
  })

  it('defaults a skill without a source to installed when the host reports it installed', () => {
    const [entry] = arrangeBotSkills([SKILLS[0]], [])
    expect(entry.source).toBe('installed')
  })

  it('defaults a skill the host reports as not installed to marketplace', () => {
    const [entry] = arrangeBotSkills([SKILLS[3]], [])
    expect(entry.source).toBe('marketplace')
  })
})
