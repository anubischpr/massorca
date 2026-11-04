// Writing a restored version into a project's design system: the tokens of the new version and its files.

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DESIGN_SYSTEM_COMPONENTS_FILE,
  DESIGN_SYSTEM_SOURCE_FILE,
  DESIGN_SYSTEM_TOKENS_FILE
} from '../../shared/prototype-design-system-files'
import { isRecord, type DesignSystemStatus } from '../../shared/prototype-design-system-tokens'
import { designSystemFolderOf } from './prototype-design-system-files'
import type { DesignSystemVersionFiles } from './prototype-design-system-version-store'

/**
 * The tokens of a restored version: the saved tokens with the next version number, and the history of the
 * current tokens plus one entry for the restore. The history is never shortened.
 */
export function tokensOfRestore(input: {
  source: Record<string, unknown>
  current: Record<string, unknown> | undefined
  status: DesignSystemStatus | undefined
  version: number
  restoredFrom: number
  at: string
}): Record<string, unknown> {
  const extensions: Record<string, unknown> = isRecord(input.source['$extensions'])
    ? input.source['$extensions']
    : {}
  const massorca: Record<string, unknown> = isRecord(extensions['massorca'])
    ? extensions['massorca']
    : {}
  const entry = {
    version: input.version,
    ...(input.status !== undefined ? { status: input.status } : {}),
    at: input.at,
    restoredFrom: input.restoredFrom
  }
  return {
    ...input.source,
    $extensions: {
      ...extensions,
      massorca: {
        ...massorca,
        version: input.version,
        updatedAt: input.at,
        history: [...historyOf(input.current), entry]
      }
    }
  }
}

/**
 * Makes the project's three known system files match a version: each file the version has is written, and each
 * known file it lacks is removed. Nothing else in design/system/ is touched. tokens.json is written last, so the
 * version moves only once the other two are in place.
 */
export async function writeDesignSystemFiles(
  root: string,
  files: DesignSystemVersionFiles & { tokensJson: string }
): Promise<void> {
  const folder = designSystemFolderOf(root)
  await mkdir(folder, { recursive: true })
  await matchFile(join(folder, DESIGN_SYSTEM_COMPONENTS_FILE), files.componentsHtml)
  await matchFile(join(folder, DESIGN_SYSTEM_SOURCE_FILE), files.systemMd)
  await writeReplacing(join(folder, DESIGN_SYSTEM_TOKENS_FILE), files.tokensJson)
}

async function matchFile(path: string, text: string | undefined): Promise<void> {
  if (text === undefined) {
    await rm(path, { force: true })
    return
  }
  await writeReplacing(path, text)
}

function historyOf(tokens: Record<string, unknown> | undefined): unknown[] {
  const extensions: Record<string, unknown> =
    tokens !== undefined && isRecord(tokens['$extensions']) ? tokens['$extensions'] : {}
  const massorca: Record<string, unknown> = isRecord(extensions['massorca'])
    ? extensions['massorca']
    : {}
  const history = massorca['history']
  return Array.isArray(history) ? history : []
}

/** Why a staged rename: a reader of the design system never sees a half-written file. */
async function writeReplacing(path: string, text: string): Promise<void> {
  const staging = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(staging, text)
    await rename(staging, path)
  } catch (error) {
    await rm(staging, { force: true })
    throw error
  }
}
