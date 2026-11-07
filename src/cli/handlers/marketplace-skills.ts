import { randomUUID } from 'node:crypto'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'
import { parseCommaList } from '../marketplace-comma-list'
import {
  installsOnMarketplaceHost,
  resolveMarketplaceSkillHost,
  type MarketplaceSkillHost
} from '../marketplace-skill-host'
import {
  formatSkillDetail,
  formatSkillInstallOutcome,
  formatSkillRows,
  toSkillRow,
  type MarketplaceSkillCopy,
  type MarketplaceSkillDetail
} from '../marketplace-skill-format'
import {
  isSkillInstallProviderId,
  SKILL_INSTALL_PROVIDERS
} from '../../shared/skill-install-providers'
import type { ManagedSkillInstall, SkillInstallResult } from '../../shared/skill-install-contract'
import type { SkillDiscoveryResult } from '../../shared/skills'
import { callMarketplaceHost, callMarketplaceHostOptional } from './marketplace-host-call'
import { installRequested, readConflict, REMOVE_CONFLICTS } from './marketplace-skill-install'

/** `--agents a,b`: absent means every detected agent; `none` means the shared folder only. */
function readSkillAgents(ctx: HandlerContext): string[] | undefined {
  const raw = getOptionalStringFlag(ctx.flags, 'agents')
  if (raw === undefined) {
    return undefined
  }
  if (raw.trim().toLowerCase() === 'none') {
    return []
  }
  const ids = parseCommaList(raw)
  if (ids.length === 0) {
    throw new RuntimeClientError('invalid_argument', '--agents needs agent ids, or "none".')
  }
  for (const id of ids) {
    if (!isSkillInstallProviderId(id)) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Unknown agent "${id}". Agents: ${SKILL_INSTALL_PROVIDERS.map((provider) => provider.id).join(', ')}`
      )
    }
  }
  return [...new Set(ids)]
}

async function installsOnHost(
  ctx: HandlerContext,
  host: MarketplaceSkillHost
): Promise<{ response: RuntimeRpcSuccess<unknown>; installs: ManagedSkillInstall[] }> {
  const response = await callMarketplaceHost<ManagedSkillInstall[]>(
    ctx,
    'skills.listManagedInstalls'
  )
  const all = Array.isArray(response.result) ? response.result : []
  return { response, installs: installsOnMarketplaceHost(host, all) }
}

function pathLeaf(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? ''
  )
}

const READER_NAMES: Record<string, string> = {
  codex: 'Codex',
  claude: 'Claude Code',
  'agent-skills': 'the shared agents folder'
}

/** The skill folders on the host, from the same discovery the desktop page reads; SSH has none yet. */
async function discoverCopies(
  ctx: HandlerContext,
  host: MarketplaceSkillHost,
  name: string
): Promise<Pick<MarketplaceSkillDetail, 'copies' | 'copiesNote'>> {
  if (host.kind === 'ssh') {
    return { copies: null, copiesNote: 'skill folders cannot be read on SSH hosts yet' }
  }
  const target = host.kind === 'wsl' ? { runtime: 'wsl', wslDistro: host.wslDistro } : {}
  try {
    const response = await callMarketplaceHostOptional<SkillDiscoveryResult>(
      ctx,
      'skills.discover',
      { ...target, names: [name], sourceKinds: ['home'], refresh: true }
    )
    if (!response) {
      return { copies: null, copiesNote: 'this host predates skill discovery' }
    }
    const copies = (response.result.skills ?? [])
      .filter((skill) => skill.name === name || pathLeaf(skill.directoryPath) === name)
      .map((skill): MarketplaceSkillCopy => ({
        directoryPath: skill.directoryPath,
        skillFilePath: skill.skillFilePath,
        readers: skill.providers.map((provider) => READER_NAMES[provider] ?? provider)
      }))
    return { copies }
  } catch (error) {
    if (error instanceof RuntimeClientError) {
      return { copies: null, copiesNote: error.message }
    }
    throw error
  }
}

async function skillDetail(
  ctx: HandlerContext,
  host: MarketplaceSkillHost,
  name: string
): Promise<{ response: RuntimeRpcSuccess<unknown>; detail: MarketplaceSkillDetail }> {
  const { response, installs } = await installsOnHost(ctx, host)
  const install = installs.find((candidate) => candidate.name === name)
  const copies = await discoverCopies(ctx, host, name)
  return {
    response,
    detail: {
      host: host.label,
      name,
      install: install ? toSkillRow(install, host.label) : null,
      ...copies
    }
  }
}

function sameAgents(recorded: readonly string[] | undefined, wanted: readonly string[]): boolean {
  const left = [...(recorded ?? [])].sort().join(',')
  return left === [...wanted].sort().join(',')
}

export const MARKETPLACE_SKILL_HANDLERS: Record<string, CommandHandler> = {
  'marketplace skills list': async (ctx) => {
    const host = await resolveMarketplaceSkillHost(ctx.flags, ctx.client)
    const { response, installs } = await installsOnHost(ctx, host)
    const rows = installs.map((install) => toSkillRow(install, host.label))
    printResult({ ...response, result: rows }, ctx.json, (value) =>
      formatSkillRows(value, host.label)
    )
  },
  'marketplace skills show': async (ctx) => {
    const name = getRequiredStringFlag(ctx.flags, 'name')
    const host = await resolveMarketplaceSkillHost(ctx.flags, ctx.client)
    const { response, detail } = await skillDetail(ctx, host, name)
    if (!detail.install && !detail.copies?.length) {
      throw new RuntimeClientError('not_found', `${name} is not installed on ${host.label}.`)
    }
    printResult({ ...response, result: detail }, ctx.json, formatSkillDetail)
  },
  'marketplace skills install': async (ctx) => {
    const host = await resolveMarketplaceSkillHost(ctx.flags, ctx.client)
    const providers = readSkillAgents(ctx)
    const response = await installRequested(ctx, host, providers)
    printResult(response, ctx.json, formatSkillInstallOutcome)
  },
  'marketplace skills agents': async (ctx) => {
    const name = getRequiredStringFlag(ctx.flags, 'name')
    const host = await resolveMarketplaceSkillHost(ctx.flags, ctx.client)
    const providers = readSkillAgents(ctx)
    if (providers === undefined) {
      throw new RuntimeClientError('invalid_argument', '--agents needs agent ids, or "none".')
    }
    const before = (await installsOnHost(ctx, host)).installs.find(
      (candidate) => candidate.name === name
    )
    if (!before) {
      throw new RuntimeClientError('not_found', `${name} is not installed on ${host.label}.`)
    }
    // Why: the desktop's agent switches re-place a copy by reinstalling the same version with new agents.
    const outcome = await installRequested(ctx, host, providers, {
      packageId: before.packageId,
      versionId: before.versionId
    })
    const { response, detail } = await skillDetail(ctx, host, name)
    if (detail.install && !sameAgents(detail.install.providers, providers)) {
      process.exitCode = 1
    }
    const reconcile = { status: outcome.result.status, placements: outcome.result.placements }
    printResult({ ...response, result: { ...detail, reconcile } }, ctx.json, formatSkillDetail)
  },
  'marketplace skills uninstall': async (ctx) => {
    const name = getRequiredStringFlag(ctx.flags, 'name')
    const host = await resolveMarketplaceSkillHost(ctx.flags, ctx.client)
    const conflict = readConflict(ctx, REMOVE_CONFLICTS)
    const response = await callMarketplaceHost<SkillInstallResult>(ctx, 'skills.removeInstall', {
      operationId: randomUUID(),
      name,
      destination: host.destination,
      ...(conflict !== undefined ? { conflictResolution: conflict } : {})
    })
    if (response.result.status !== 'removed') {
      process.exitCode = 1
    }
    printResult(response, ctx.json, (value) => `${value.name}: ${value.status}`)
  }
}
