import { basename } from '@/lib/path'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import type { DiscoveredSkill } from '../../../../shared/skills'

type InstallScope = ManagedSkillInstall['scope']

/** Home roots are the global scope and repo roots the workspace scope. */
function scopeOf(skill: DiscoveredSkill): InstallScope | null {
  if (skill.sourceKind === 'home') {
    return 'global'
  }
  return skill.sourceKind === 'repo' ? 'workspace' : null
}

function installKey(scope: InstallScope, folder: string): string {
  return `${scope}\0${folder.toLowerCase()}`
}

/**
 * Marks the skills MassOrca installed from the Marketplace with `source: 'marketplace'`.
 * Why: installs list their folder and scope, never their path, so a same-named hand copy is marked too.
 */
export function markMarketplaceManagedSkills(
  skills: readonly DiscoveredSkill[],
  installs: readonly ManagedSkillInstall[]
): DiscoveredSkill[] {
  const managed = new Set(
    installs
      .filter((install) => install.state !== 'missing')
      .map((install) => installKey(install.scope, install.name))
  )
  return skills.map((skill): DiscoveredSkill => {
    const scope = scopeOf(skill)
    if (scope === null || !managed.has(installKey(scope, basename(skill.directoryPath)))) {
      return skill
    }
    return { ...skill, source: 'marketplace' }
  })
}
