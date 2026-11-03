import { access, lstat, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { isMissingFile } from './bot-team-content-store'
import { parseIgnoreRules } from './bot-team-snapshot-ignore'
import { SnapshotFailure } from './bot-team-snapshot-run'
import type { BotTeamSnapshotLimits } from './bot-team-snapshot-types'

/** A regular file a version may hold, keyed by its path inside the folder. */
export type SavableFile = { relativePath: string; absolutePath: string }

export type SavableFiles = { files: SavableFile[]; skipped: number }

/**
 * The files a version holds: not ignored by the folder's .gitignore, not inside a Git repository
 * of their own, and not links. Files over the size limit are counted as skipped, not kept.
 */
export async function savableFilesOf(
  folder: string,
  limits: BotTeamSnapshotLimits
): Promise<SavableFiles> {
  const ignored = parseIgnoreRules(await readIgnoreText(folder))
  const files: SavableFile[] = []
  let skipped = 0
  let counted = 0

  const walk = async (relativeDirectory: string): Promise<void> => {
    const directory = path.join(folder, relativeDirectory)
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    )
    for (const entry of entries) {
      if (entry.name === '.git') {
        continue
      }
      const relativePath =
        relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!ignored(relativePath, true) && !(await hasOwnRepository(absolutePath))) {
          await walk(relativePath)
        }
        continue
      }
      if (!entry.isFile() || ignored(relativePath, false)) {
        continue
      }
      counted += 1
      if (counted > limits.maxFiles) {
        throw new SnapshotFailure(
          'too-large',
          'This folder has too many files to save as a version.'
        )
      }
      const size = await sizeOf(absolutePath)
      if (size === null) {
        continue
      }
      if (size > limits.maxFileBytes) {
        skipped += 1
      } else {
        files.push({ relativePath, absolutePath })
      }
    }
  }

  await walk('')
  return { files, skipped }
}

async function readIgnoreText(folder: string): Promise<string> {
  try {
    return await readFile(path.join(folder, '.gitignore'), 'utf8')
  } catch (error) {
    if (isMissingFile(error)) {
      return ''
    }
    throw error
  }
}

// A folder with its own .git is another repository: the team's versions leave it alone.
async function hasOwnRepository(directory: string): Promise<boolean> {
  return access(path.join(directory, '.git')).then(
    () => true,
    () => false
  )
}

async function sizeOf(file: string): Promise<number | null> {
  try {
    return (await lstat(file)).size
  } catch (error) {
    if (isMissingFile(error)) {
      return null
    }
    throw error
  }
}
