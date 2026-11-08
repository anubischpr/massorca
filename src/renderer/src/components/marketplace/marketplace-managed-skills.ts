import { basename } from '@/lib/path'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import type { DiscoveredSkill } from '../../../../shared/skills'

type InstallScope = ManagedSkillInstall['scope']

/** The installs MassOrca placed on a host; a listing that fails or is unsupported reads as none. */
export async function readManagedSkillInstalls(
  environmentId?: string
): Promise<readonly ManagedSkillInstall[]> {
  try {
    const operation = await window.api.skills.listManagedInstalls(environmentId)
    return operation.status === 'ok' ? operation.value : []
  } catch (cause) {
    console.warn('[skills] managed install listing failed:', cause)
    return []
  }
}

/** The global installs placed on one WSL distro; the local listing carries every distro's installs too. */
export function wslInstallsOf(
  installs: readonly ManagedSkillInstall[],
  distro: string
): ManagedSkillInstall[] {
  return installs.filter((install) => {
    const target =
      install.destination.scope === 'global' ? install.destination.executionTarget : undefined
    return target?.kind === 'wsl' && target.distro === distro
  })
}

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
