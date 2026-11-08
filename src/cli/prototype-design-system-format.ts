import type { PrototypeDesignSystemReadability } from '../shared/prototype-design-system-readability'

/** The human verdict: readable or not, the folder, version and files read, then one line per reason. */
export function formatDesignSystemReadability(verdict: PrototypeDesignSystemReadability): string {
  const lines = [verdict.readable ? 'readable' : 'not readable']
  if (verdict.folderPath !== undefined) {
    lines.push(`folder: ${verdict.folderPath}`)
  }
  if (verdict.version !== undefined) {
    lines.push(`version: ${verdict.version}`)
  }
  lines.push(`files read: ${verdict.filesRead.length > 0 ? verdict.filesRead.join(', ') : 'none'}`)
  lines.push(...verdict.reasons.map((reason) => `- ${reason}`))
  return lines.join('\n')
}
