/**
 * Reads `engram projects list`: a heading, then one indented row per project, "NAME 12 obs 3
 * sessions 4 prompts". Only names are kept.
 */
export function parseEngramProjectNames(output: string): string[] {
  const names: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s+(\S.*?)\s+\d+\s+obs\b/i.exec(line)
    if (match && !names.includes(match[1])) {
      names.push(match[1])
    }
  }
  return names
}

/** Reads the "Project enrollment: ..." line of `engram cloud status --project <name>`. */
export function parseEngramEnrollment(output: string): boolean | null {
  const match = /^\s*Project enrollment:\s*(.+)$/im.exec(output)
  if (!match) {
    return null
  }
  const state = match[1].trim().toLowerCase()
  if (state.startsWith('not enrolled')) {
    return false
  }
  return state.startsWith('enrolled') ? true : null
}

/** A name is safe to hand over as one argument when it cannot read as an option. */
export function isSafeEngramProjectName(name: string): boolean {
  return name.length > 0 && name.length <= 256 && !name.startsWith('-') && !/[\0\r\n]/.test(name)
}
