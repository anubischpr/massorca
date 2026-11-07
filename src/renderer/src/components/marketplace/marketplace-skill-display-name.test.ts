import { describe, expect, it } from 'vitest'
import { skillDisplayName } from './marketplace-skill-display-name'

describe('skillDisplayName', () => {
  it('drops the leading slash of a command and sentence-cases it', () => {
    expect(skillDisplayName('/prototype')).toBe('Prototype')
    expect(skillDisplayName('orca orchestration delegate')).toBe('Orca orchestration delegate')
  })

  it('turns hyphens and underscores into spaces', () => {
    expect(skillDisplayName('computer-use')).toBe('Computer use')
    expect(skillDisplayName('browser_use')).toBe('Browser use')
    expect(skillDisplayName('my--skill__name')).toBe('My skill name')
  })

  it('keeps a plugin prefix readable', () => {
    expect(skillDisplayName('expo:expo-router')).toBe('Expo: expo router')
  })

  it('leaves a label that is already human as it is', () => {
    expect(skillDisplayName('Browser use')).toBe('Browser use')
    expect(skillDisplayName('GitHub CLI')).toBe('GitHub CLI')
  })

  it('shows the real name when nothing readable is left', () => {
    expect(skillDisplayName('/')).toBe('/')
  })
})
