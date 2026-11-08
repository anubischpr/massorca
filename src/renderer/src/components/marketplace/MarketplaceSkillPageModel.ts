import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { SkillInstallProviderDefinition } from '../../../../shared/skill-install-providers'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { SHARED_SKILL_AGENT } from '../skills/skill-agent-filter'
import { normalizeSkillName } from './MarketplaceCatalogPlaceholders'

export type MarketplaceSkillOrigin = {
  kind: 'pool' | 'folder' | 'plugin' | 'custom'
  name: string
  detail: string
}

/** What the skill page shows: one skill, with the agents and folders of every copy on its host. */
export type MarketplaceSkillPageSkill = {
  /** The real name: matching, installs and paths use it; the page shows its display name. */
  name: string
  description: string | null
  installed: boolean
  /** Agents that hold a copy; `shared` is the `.agents/skills` root every canonical reader uses. */
  agentIds: readonly string[]
  /** Share link the skill installs from; empty opens the dialog on its paste step. */
  installLink: string
  /** The folder names the copies sit in on their host; a managed install is listed under one of them. */
  folders: readonly string[]
  origin: MarketplaceSkillOrigin
}

/** A row a skill page opens for: a scanned skill, a custom skill the person added, or a MassOrca board skill. */
export type MarketplaceSkillListing =
  | { kind: 'discovered'; skill: DiscoveredSkill }
  | { kind: 'custom'; item: MarketplaceCustomItemStatus }
  | { kind: 'board'; name: string; description: string }

/** What one skill page reads: the skill, and every copy of it on the host the page reads. */
export type MarketplaceSkillPageData = {
  skill: MarketplaceSkillPageSkill
  copies: readonly DiscoveredSkill[]
}

function poolOrigin(): MarketplaceSkillOrigin {
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

export function marketplaceSkillOrigin(skill: DiscoveredSkill): MarketplaceSkillOrigin {
  if (skill.sourceKind === 'bundled') {
    return poolOrigin()
  }
  return {
    kind: skill.sourceKind === 'plugin' ? 'plugin' : 'folder',
    name: skill.sourceLabel,
    detail: skill.directoryPath
  }
}

/** Every copy of a skill on one host, matched by name the way the list keeps one row per skill. */
export function skillCopiesNamed(
  skills: readonly DiscoveredSkill[],
  name: string
): DiscoveredSkill[] {
  const key = normalizeSkillName(name)
  return skills.filter((skill) => normalizeSkillName(skill.name) === key)
}

/**
 * The page data for a listed row, read from one scan of its host; null when a scanned skill is gone.
 * Why: a custom skill with no copy on the host still opens, showing the install state its item reports.
 */
export function marketplaceSkillPageFromScan(
  listing: MarketplaceSkillListing,
  skills: readonly DiscoveredSkill[],
  agentByRootPath: ReadonlyMap<string, string>
): MarketplaceSkillPageData | null {
  if (listing.kind === 'discovered') {
    const copies = skillCopiesNamed(skills, listing.skill.name)
    if (copies.length === 0) {
      return null
    }
    return { skill: skillFromCopies(listing.skill.name, copies, agentByRootPath), copies }
  }
  // Why: a board skill with no copy on the host still opens, showing Install on the picked host.
  if (listing.kind === 'board') {
    const copies = skillCopiesNamed(skills, listing.name)
    if (copies.length === 0) {
      return { skill: boardSkillWithoutCopy(listing), copies }
    }
    const shown = skillFromCopies(listing.name, copies, agentByRootPath)
    return { skill: { ...shown, description: shown.description ?? listing.description }, copies }
  }
  const { item } = listing
  const copies = skillCopiesNamed(skills, item.name)
  if (copies.length === 0) {
    return { skill: customSkillWithoutCopy(item), copies }
  }
  return {
    skill: {
      ...skillFromCopies(item.name, copies, agentByRootPath),
      installLink: item.skillUrl ?? ''
    },
    copies
  }
}

/** One skill from its copies: the agents and folders of all of them, installed when any copy is. */
function skillFromCopies(
  name: string,
  copies: readonly DiscoveredSkill[],
  agentByRootPath: ReadonlyMap<string, string>
): MarketplaceSkillPageSkill {
  const shown = copies.find((copy) => copy.installed) ?? copies[0]
  return {
    name,
    description: copies.find((copy) => copy.description)?.description ?? null,
    installed: copies.some((copy) => copy.installed),
    agentIds: unique(copies.flatMap((copy) => agentIdsOf(copy, agentByRootPath))),
    installLink: '',
    folders: unique(copies.map((copy) => basename(copy.directoryPath))),
    origin: marketplaceSkillOrigin(shown)
  }
}

function agentIdsOf(copy: DiscoveredSkill, agentByRootPath: ReadonlyMap<string, string>): string[] {
  const roots = copy.rootPaths?.length ? copy.rootPaths : [copy.rootPath]
  return roots.flatMap((root) => {
    const id = agentByRootPath.get(root)
    return id ? [id] : []
  })
}

function boardSkillWithoutCopy(listing: {
  name: string
  description: string
}): MarketplaceSkillPageSkill {
  return {
    name: listing.name,
    description: listing.description,
    installed: false,
    agentIds: [],
    installLink: '',
    folders: [],
    origin: poolOrigin()
  }
}

function customSkillWithoutCopy(item: MarketplaceCustomItemStatus): MarketplaceSkillPageSkill {
  const link = item.skillUrl ?? ''
  return {
    name: item.name,
    description: null,
    installed: item.presence === 'found',
    agentIds: [],
    installLink: link,
    folders: [],
    origin: {
      kind: 'custom',
      name: translate(
        'auto.components.marketplace.MarketplaceSkillPage.customOrigin',
        'Added by you'
      ),
      detail: link
    }
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
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
