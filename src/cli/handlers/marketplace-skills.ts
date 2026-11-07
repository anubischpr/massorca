import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
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
import {
  SkillInstallResultSchema,
  type ManagedSkillInstall,
  type SkillInstallResult
} from '../../shared/skill-install-contract'
import {
  SKILL_UPLOAD_CHUNK_MAX_BYTES,
  SkillUploadBeginResultSchema
} from '../../shared/skill-upload-session-contract'
import type { SkillDiscoveryResult } from '../../shared/skills'
import { callMarketplaceHost, callMarketplaceHostOptional } from './marketplace-host-call'
import { readSkillPackageFile, type ReadSkillPackageFile } from './marketplace-skill-package-file'

const INSTALL_CONFLICTS = ['replace-unmodified', 'replace-and-discard-local', 'cancel'] as const
const REMOVE_CONFLICTS = ['replace-and-discard-local', 'cancel'] as const
const SUCCESS_STATUSES: readonly SkillInstallResult['status'][] = [
  'installed',
  'updated',
  'unchanged'
]

function readConflict<T extends string>(ctx: HandlerContext, allowed: readonly T[]): T | undefined {
  const value = getOptionalStringFlag(ctx.flags, 'conflict')
  if (value === undefined) {
    return undefined
  }
  const choice = allowed.find((candidate) => candidate === value)
  if (!choice) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Unknown --conflict "${value}". Choices: ${allowed.join(', ')}`
    )
  }
  return choice
}

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

/** Streams a local package file to the host's staging area; the host re-verifies every byte. */
async function stagePackage(ctx: HandlerContext, pkg: ReadSkillPackageFile): Promise<string> {
  const begin = SkillUploadBeginResultSchema.parse(
    (await callMarketplaceHost(ctx, 'skills.beginUpload', { package: pkg.identity })).result
  )
  const chunkBytes = Math.min(begin.chunkBytes, SKILL_UPLOAD_CHUNK_MAX_BYTES)
  let offset = begin.acknowledgedOffset
  try {
    while (offset < pkg.bytes.length) {
      const chunk = pkg.bytes.subarray(offset, offset + chunkBytes)
      const answer = await callMarketplaceHost<{ acknowledgedOffset?: number }>(
        ctx,
        'skills.uploadChunk',
        { uploadId: begin.uploadId, offset, bytesBase64: chunk.toString('base64') }
      )
      const acknowledged = answer.result.acknowledgedOffset
      if (typeof acknowledged !== 'number' || acknowledged <= offset) {
        throw new RuntimeClientError('runtime_error', 'The host did not accept the package upload.')
      }
      offset = acknowledged
    }
    await callMarketplaceHost(ctx, 'skills.commitUpload', { uploadId: begin.uploadId })
  } catch (error) {
    await callMarketplaceHost(ctx, 'skills.cancelUpload', { uploadId: begin.uploadId }).catch(
      () => undefined
    )
    throw error
  }
  return begin.uploadId
}

async function installPackage(
  ctx: HandlerContext,
  host: MarketplaceSkillHost,
  pkg: ReadSkillPackageFile,
  providers: string[] | undefined
): Promise<RuntimeRpcSuccess<SkillInstallResult>> {
  // Why: a host's SSH relay only takes cloud download grants, so a local package file cannot reach it.
  if (host.kind === 'ssh') {
    throw new RuntimeClientError(
      'invalid_argument',
      'Installing a package file on an SSH host is not supported yet: the SSH relay only accepts a cloud download grant. Install it from Marketplace in the desktop app.'
    )
  }
  const conflict = readConflict(ctx, INSTALL_CONFLICTS)
  const uploadId = await stagePackage(ctx, pkg)
  const response = await callMarketplaceHost(ctx, 'skills.install', {
    operationId: randomUUID(),
    package: pkg.identity,
    ingress: { kind: 'staged-upload', uploadId },
    destination: host.destination,
    ...(providers !== undefined ? { providers } : {}),
    ...(conflict !== undefined ? { conflictResolution: conflict } : {})
  })
  const result = SkillInstallResultSchema.safeParse(response.result)
  if (!result.success) {
    throw new RuntimeClientError(
      'runtime_error',
      'The host answered the install in an unknown shape.'
    )
  }
  if (!SUCCESS_STATUSES.includes(result.data.status)) {
    process.exitCode = 1
  }
  return { ...response, result: result.data }
}

async function readPackageFlag(ctx: HandlerContext): Promise<ReadSkillPackageFile> {
  return readSkillPackageFile(resolve(ctx.cwd, getRequiredStringFlag(ctx.flags, 'file')))
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
    const pkg = await readPackageFlag(ctx)
    const response = await installPackage(ctx, host, pkg, providers)
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
    // Why: no RPC changes a copy's agents from the host's own files, so this reinstalls the same package.
    const pkg = await readPackageFlag(ctx)
    const { packageId, versionId, packageDigest } = pkg.identity
    if (
      packageId !== before.packageId ||
      versionId !== before.versionId ||
      packageDigest !== before.packageDigest
    ) {
      throw new RuntimeClientError(
        'invalid_argument',
        `${name} on ${host.label} is package ${before.packageId} version ${before.versionId}; --file is a different package or version. Use \`orca marketplace skills install\` to change versions.`
      )
    }
    const outcome = await installPackage(ctx, host, pkg, providers)
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
