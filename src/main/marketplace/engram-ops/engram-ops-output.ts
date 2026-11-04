import type { EngramImportCounts } from '../../../shared/marketplace-engram-ops'

const VERSION = '(\\d+\\.\\d+\\.\\d+)'
const UPDATE_LINE = new RegExp(
  `Update available:?\\s*v?${VERSION}\\s*(?:->|\\u2192)\\s*v?${VERSION}`,
  'i'
)

/** Reads `engram version` output, with or without the "Update available X -> Y" notice. */
export function parseEngramVersionOutput(output: string): {
  current: string | null
  latest: string | null
} {
  const update = UPDATE_LINE.exec(output)
  if (update) {
    return { current: update[1], latest: update[2] }
  }
  return { current: new RegExp(VERSION).exec(output)?.[1] ?? null, latest: null }
}

const RELEASES_URL = 'https://github.com/Gentleman-Programming/engram/releases/latest'

/**
 * MassOrca does not know how this copy of Engram was installed and the CLI has no update command,
 * so there is nothing safe to run: hand back the CLI's own advice (or the releases page).
 */
export function selectEngramUpdateAdvice(notice: string): { instruction: string; url: string } {
  const goInstall = /^\s*(?:or:\s*)?(go install \S+@latest)\s*$/im.exec(notice)?.[1]
  return {
    instruction: goInstall
      ? `Run "${goInstall}" in a terminal, or download the latest release.`
      : 'Download the latest release and replace your Engram program.',
    url: RELEASES_URL
  }
}

function countFor(output: string, noun: string): number | undefined {
  const match = new RegExp(`(\\d+)\\s+${noun}`, 'i').exec(output)
  return match ? Number(match[1]) : undefined
}

/** Counts the CLI prints after an import; only numbers ever leave this function. */
export function parseEngramImportCounts(output: string): EngramImportCounts {
  const counts: EngramImportCounts = {}
  const observations = countFor(output, 'observations?')
  const sessions = countFor(output, 'sessions?')
  const prompts = countFor(output, 'prompts?')
  if (observations !== undefined) {
    counts.observations = observations
  }
  if (sessions !== undefined) {
    counts.sessions = sessions
  }
  if (prompts !== undefined) {
    counts.prompts = prompts
  }
  return counts
}
