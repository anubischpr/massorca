import { DESIGN_SYSTEM_FOLDER } from '../prototype-design-system-files'

const HIDDEN_SEGMENTS = new Set(['node_modules'])

/**
 * Whether a file shows in a team's Files, in its folder or a linked project's folder: tool folders,
 * dot files (such as .atl or .git) and the design system a prototype writes never do.
 */
export function isBotTeamFileVisible(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/)
  return (
    !segments.join('/').startsWith(`${DESIGN_SYSTEM_FOLDER}/`) &&
    segments.every((segment) => !segment.startsWith('.') && !HIDDEN_SEGMENTS.has(segment))
  )
}
