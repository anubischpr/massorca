/**
 * Folder name `git clone <url>` creates, shared so the Add Project dialog previews
 * exactly the path main will clone into.
 */
function basenameOf(source: string, separators: RegExp): string {
  const trimmed = source.replace(new RegExp(`(?:${separators.source})+$`), '')
  const parts = trimmed.split(separators)
  return parts.at(-1) ?? ''
}

/** Throws for names that would resolve to the destination itself or its parent. */
export function deriveCloneRepoName(url: string): string {
  // Why: direct callers can supply URLs whose default git clone folder would
  // be "." or ".."; rejecting them prevents parent/destination deletion.
  const source = url.replace(/\.git\/?$/, '')
  const isWindowsLocalSource = /^[A-Za-z]:[\\/]/.test(source) || source.startsWith('\\\\')
  const repoName = isWindowsLocalSource ? basenameOf(source, /[\\/]/) : basenameOf(source, /\//)
  if (!repoName || repoName === '.' || repoName === '..') {
    throw new Error('Invalid repository name derived from URL')
  }
  if (repoName.includes('/') || repoName.includes('\\')) {
    throw new Error('Invalid repository name derived from URL')
  }
  return repoName
}

/** Null while the URL cannot name a folder yet (empty or invalid). */
export function tryDeriveCloneRepoName(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) {
    return null
  }
  try {
    return deriveCloneRepoName(trimmed)
  } catch {
    return null
  }
}
