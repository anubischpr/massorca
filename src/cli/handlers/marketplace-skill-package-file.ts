import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { RuntimeClientError } from '../runtime-client'
import {
  SKILL_PACKAGE_MAX_COMPRESSED_BYTES,
  SKILL_PACKAGE_MAX_MANIFEST_BYTES,
  SkillPackageManifestV1Schema
} from '../../shared/skill-package-manifest'
import type { SkillPackageIdentity } from '../../shared/skill-install-contract'

const TAR_BLOCK_BYTES = 512
export type ReadSkillPackageFile = {
  identity: SkillPackageIdentity
  name: string
  bytes: Buffer
}

function tarText(block: Buffer, start: number, end: number): string {
  const field = block.subarray(start, end)
  const terminator = field.indexOf(0)
  return field.subarray(0, terminator === -1 ? field.length : terminator).toString('utf8')
}

function invalid(path: string, why: string): RuntimeClientError {
  return new RuntimeClientError(
    'invalid_argument',
    `${path} is not a MassOrca skill package (${why}).`
  )
}

/** Reads a skill package file and the identity the host checks it against; the host re-verifies every byte. */
export async function readSkillPackageFile(path: string): Promise<ReadSkillPackageFile> {
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) {
    throw new RuntimeClientError('invalid_argument', `Skill package file not found: ${path}`)
  }
  if (info.size > SKILL_PACKAGE_MAX_COMPRESSED_BYTES) {
    throw invalid(path, 'larger than 40 MB')
  }
  const bytes = await readFile(path)
  let expanded: Buffer
  try {
    expanded = gunzipSync(bytes, { maxOutputLength: SKILL_PACKAGE_MAX_COMPRESSED_BYTES * 2 })
  } catch {
    throw invalid(path, 'not a .tar.gz archive')
  }
  const header = expanded.subarray(0, TAR_BLOCK_BYTES)
  const size = Number.parseInt(tarText(header, 124, 136).trim(), 8)
  if (
    tarText(header, 0, 100) !== 'manifest.json' ||
    !Number.isInteger(size) ||
    size > SKILL_PACKAGE_MAX_MANIFEST_BYTES ||
    expanded.length < TAR_BLOCK_BYTES + size
  ) {
    throw invalid(path, 'no manifest.json first in the archive')
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(
      expanded.subarray(TAR_BLOCK_BYTES, TAR_BLOCK_BYTES + size).toString('utf8')
    )
  } catch {
    throw invalid(path, 'manifest.json is not valid JSON')
  }
  const parsed = SkillPackageManifestV1Schema.safeParse(manifest)
  if (!parsed.success) {
    throw invalid(path, 'manifest.json is not a version 1 skill manifest')
  }
  return {
    name: parsed.data.name,
    bytes,
    identity: {
      packageId: parsed.data.packageId,
      versionId: parsed.data.versionId,
      packageDigest: parsed.data.packageDigest,
      archiveSha256: createHash('sha256').update(bytes).digest('hex'),
      compressedBytes: bytes.length
    }
  }
}
