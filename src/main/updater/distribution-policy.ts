import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export const MANUAL_UPDATE_MESSAGE =
  'This distribution uses controlled manual updates. Install a verified build from your maintainer.'

/** An absent marker preserves official builds; unknown distribution markers fail closed. */
export function permitsAutomaticUpdates(metadata: unknown): boolean {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Object.hasOwn(metadata, 'orcaDistribution')
  )
}

export function readDistributionUpdatePolicy(): boolean {
  if (!app.isPackaged) {
    return true
  }
  try {
    const metadata: unknown = JSON.parse(
      readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')
    )
    return permitsAutomaticUpdates(metadata)
  } catch {
    // An unreadable packaged identity must not silently select the official release feed.
    return false
  }
}
