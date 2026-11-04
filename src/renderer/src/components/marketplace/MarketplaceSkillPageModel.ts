import { translate } from '@/i18n/i18n'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { SkillInstallProviderDefinition } from '../../../../shared/skill-install-providers'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { SHARED_SKILL_AGENT } from '../skills/skill-agent-filter'

export type MarketplaceSkillOrigin = {
  kind: 'pool' | 'folder' | 'plugin'
  name: string
  detail: string
}

/** What the skill page shows; the catalog builds it from a discovered skill or its own entry. */
export type MarketplaceSkillPageSkill = {
  name: string
  description: string | null
  installed: boolean
  /** Agents that hold a copy; `shared` is the `.agents/skills` root every canonical reader uses. */
  agentIds: readonly string[]
  /** Share link the skill installs from; empty opens the dialog on its paste step. */
  installLink: string
  origin: MarketplaceSkillOrigin
}

export function marketplaceSkillOrigin(skill: DiscoveredSkill): MarketplaceSkillOrigin {
  if (skill.sourceKind === 'bundled') {
    return {
      kind: 'pool',
      name: translate(
        'auto.components.marketplace.MarketplaceSkillPage.pool',
        'MassOrca skills pool'
      ),
      detail: translate(
        'auto.components.marketplace.MarketplaceSkillPage.poolDetail',
        'Bundled with this version of MassOrca.'
      )
    }
  }
  return {
    kind: skill.sourceKind === 'plugin' ? 'plugin' : 'folder',
    name: skill.sourceLabel,
    detail: skill.directoryPath
  }
}

/** A discovered skill as the page reads it; `agentByRootPath` comes from `skillAgentByRootPath`. */
export function marketplaceSkillFromDiscovered(
  skill: DiscoveredSkill,
  agentByRootPath: ReadonlyMap<string, string>
): MarketplaceSkillPageSkill {
  const roots = skill.rootPaths?.length ? skill.rootPaths : [skill.rootPath]
  const agentIds = [
    ...new Set(
      roots.flatMap((root) => {
        const id = agentByRootPath.get(root)
        return id ? [id] : []
      })
    )
  ]
  return {
    name: skill.name,
    description: skill.description,
    installed: skill.installed,
    agentIds,
    installLink: '',
    origin: marketplaceSkillOrigin(skill)
  }
}

/** Whether an agent already reads this skill: it owns a root holding it, or reads the shared root. */
export function marketplaceSkillReachesAgent(
  provider: SkillInstallProviderDefinition,
  agentIds: readonly string[]
): boolean {
  return (
    agentIds.includes(provider.id) ||
    (provider.globalSegments === null && agentIds.includes(SHARED_SKILL_AGENT))
  )
}

export type MarketplaceSkillTeam = {
  id: string
  name: string
  botCount: number
  usesSkill: boolean
}

export function marketplaceSkillTeams(
  teams: readonly BotTeam[],
  skillName: string
): MarketplaceSkillTeam[] {
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    botCount: team.bots.length,
    usesSkill: team.bots.some((bot) => bot.skills.includes(skillName))
  }))
}

/** "Bot · Team" for every bot that has the skill in its profile. */
export function marketplaceSkillBots(teams: readonly BotTeam[], skillName: string): string[] {
  return teams.flatMap((team) =>
    team.bots
      .filter((bot) => bot.skills.includes(skillName))
      .map((bot) => `${bot.name} · ${team.name}`)
  )
}
