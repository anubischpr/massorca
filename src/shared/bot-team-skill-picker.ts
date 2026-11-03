/** Where a skill row comes from; `added` means this bot already has it selected. */
export type BotSkillSource = 'installed' | 'added' | 'marketplace'

/** The fields the picker reads; `source` is optional so older hosts still work. */
export type BotSkillPickerSkill = {
  name: string
  description: string | null
  installed: boolean
  /** Host-reported origin; absent on older hosts, which report `installed` only. */
  source?: 'installed' | 'marketplace'
}

export type BotSkillListEntry<T extends BotSkillPickerSkill> = {
  skill: T
  source: BotSkillSource
}

const SOURCE_RANK: Record<BotSkillSource, number> = { added: 0, installed: 1, marketplace: 2 }

/** Lowercase with accents and combining marks removed, so "Café" matches "cafe". */
export function foldSkillSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Every query word must appear in the name or description; a blank query keeps all. */
export function filterBotSkills<T extends BotSkillPickerSkill>(
  skills: readonly T[],
  query: string
): T[] {
  const words = foldSkillSearchText(query)
    .split(/\s+/)
    .filter((word) => word !== '')
  if (words.length === 0) {
    return [...skills]
  }
  return skills.filter((skill) => {
    const haystack = foldSkillSearchText(`${skill.name} ${skill.description ?? ''}`)
    return words.every((word) => haystack.includes(word))
  })
}

/** Added to this bot first, then installed, then the rest; host order is kept within each group. */
export function arrangeBotSkills<T extends BotSkillPickerSkill>(
  skills: readonly T[],
  addedNames: readonly string[]
): BotSkillListEntry<T>[] {
  const added = new Set(addedNames)
  return skills
    .map((skill) => {
      const source: BotSkillSource = added.has(skill.name)
        ? 'added'
        : (skill.source ?? (skill.installed ? 'installed' : 'marketplace'))
      return { skill, source }
    })
    .sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source])
}
