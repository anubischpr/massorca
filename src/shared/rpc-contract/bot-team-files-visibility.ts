const HIDDEN_SEGMENTS = new Set(['node_modules'])

/**
 * Whether a file shows in a team's Files, in its folder or a linked project's folder: tool folders
 * and dot files (such as .atl or .git) never do.
 */
export function isBotTeamFileVisible(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]/)
    .every((segment) => !segment.startsWith('.') && !HIDDEN_SEGMENTS.has(segment))
}
