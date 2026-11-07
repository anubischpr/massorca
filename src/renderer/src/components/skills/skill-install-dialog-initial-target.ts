import type { SkillInstallProviderId } from '../../../../shared/skill-install-providers'

/**
 * Where the install dialog starts: a machine (`local`, a runtime environment id, or `ssh:<id>`), the WSL
 * distro of this computer when the install runs there, and the agents the install starts with.
 */
export type SkillInstallInitialTarget = {
  environmentId: string
  executionTarget?: { kind: 'wsl'; distro: string } | null
  /** Agents the install starts with; absent means the agents the machine has. */
  providers?: readonly SkillInstallProviderId[]
}

/** The dialog's starting state when a target is given; absent, it is this computer with its detected agents. */
export function skillInstallStartState(target: SkillInstallInitialTarget | undefined): {
  environmentId: string
  executionTarget: { kind: 'wsl'; distro: string } | null
  providers: Set<SkillInstallProviderId> | null
} {
  return {
    environmentId: target?.environmentId ?? 'local',
    executionTarget: target?.executionTarget ?? null,
    providers: target?.providers ? new Set(target.providers) : null
  }
}
