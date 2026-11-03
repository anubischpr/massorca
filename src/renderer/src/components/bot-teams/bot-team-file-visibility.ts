/** A file of the team folder that Files and the file picker list: tool folders and dot files never are. */
const HIDDEN_SEGMENTS = new Set(['node_modules'])

export function isBotTeamFileVisible(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]/)
    .every((segment) => !segment.startsWith('.') && !HIDDEN_SEGMENTS.has(segment))
}
