import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import type { HandlerContext } from '../dispatch'
import { getOptionalStringFlag } from '../flags'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'
import type { MarketplaceSkillHost } from '../marketplace-skill-host'
import {
  SkillInstallResultSchema,
  type SkillInstallResult
} from '../../shared/skill-install-contract'
import {
  SKILL_UPLOAD_CHUNK_MAX_BYTES,
  SkillUploadBeginResultSchema
} from '../../shared/skill-upload-session-contract'
import { callMarketplaceHost } from './marketplace-host-call'
import { readSkillPackageFile, type ReadSkillPackageFile } from './marketplace-skill-package-file'

const INSTALL_CONFLICTS = ['replace-unmodified', 'replace-and-discard-local', 'cancel'] as const
export const REMOVE_CONFLICTS = ['replace-and-discard-local', 'cancel'] as const
const SUCCESS_STATUSES: readonly SkillInstallResult['status'][] = [
  'installed',
  'updated',
  'unchanged'
]

export function readConflict<T extends string>(
  ctx: HandlerContext,
  allowed: readonly T[]
): T | undefined {
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

/** Catalog install: the host's desktop mints the cloud download grant, so SSH hosts work too. */
async function installCatalogVersion(
  ctx: HandlerContext,
  host: MarketplaceSkillHost,
  version: { packageId: string; versionId: string },
  providers: string[] | undefined
): Promise<RuntimeRpcSuccess<SkillInstallResult>> {
  const conflict = readConflict(ctx, INSTALL_CONFLICTS)
  const response = await callMarketplaceHost(ctx, 'skills.installPackageVersion', {
    operationId: randomUUID(),
    ...version,
    destination: host.destination,
    ...(providers !== undefined ? { providers } : {}),
    ...(conflict !== undefined ? { conflictResolution: conflict } : {})
  })
  const result = SkillInstallResultSchema.safeParse(response.result)
  if (result.success) {
    if (!SUCCESS_STATUSES.includes(result.data.status)) {
      process.exitCode = 1
    }
    return { ...response, result: result.data }
  }
  // Why: the other answers are a refused grant or an outdated host, both `{status, message?}`.
  const answer = response.result
  const field = (key: string): string | undefined =>
    typeof answer === 'object' && answer !== null && key in answer
      ? String(Reflect.get(answer, key))
      : undefined
  throw new RuntimeClientError(
    'runtime_error',
    `The host could not install ${version.packageId}@${version.versionId}: ${field('status') ?? 'failed'}${field('message') ? ` (${field('message')})` : ''}`
  )
}

/** `--file` uploads a package from here; `--package` with `--version` installs from the catalog. */
export async function installRequested(
  ctx: HandlerContext,
  host: MarketplaceSkillHost,
  providers: string[] | undefined,
  installed?: { packageId: string; versionId: string }
): Promise<RuntimeRpcSuccess<SkillInstallResult>> {
  const file = getOptionalStringFlag(ctx.flags, 'file')
  const packageId = getOptionalStringFlag(ctx.flags, 'package')
  const versionId = getOptionalStringFlag(ctx.flags, 'version')
  if (file !== undefined && (packageId !== undefined || versionId !== undefined)) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pass either --file or --package with --version, not both.'
    )
  }
  if (file !== undefined) {
    const pkg = await readSkillPackageFile(resolve(ctx.cwd, file))
    if (
      installed &&
      (pkg.identity.packageId !== installed.packageId ||
        pkg.identity.versionId !== installed.versionId)
    ) {
      throw new RuntimeClientError(
        'invalid_argument',
        `The host has package ${installed.packageId} version ${installed.versionId}; --file is a different package or version. Use \`orca marketplace skills install\` to change versions.`
      )
    }
    return installPackage(ctx, host, pkg, providers)
  }
  if (installed) {
    return installCatalogVersion(ctx, host, installed, providers)
  }
  if (packageId === undefined || versionId === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Name the skill with --package <id> --version <id>, or a package file with --file <path>.'
    )
  }
  return installCatalogVersion(ctx, host, { packageId, versionId }, providers)
}
