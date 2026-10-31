import {
  getBranchPrefixIssue,
  normalizeBranchPrefix,
  selectBranchPrefixInput,
  type BranchPrefixSettings
} from '../branch-prefix'

/**
 * The user's own configured branch prefix, or null when none applies. Only this prefix is ever
 * hidden from a branch label: a teammate's `alice/` is information the row must keep.
 */
export function getOwnBranchPrefix(
  settings: BranchPrefixSettings | null | undefined,
  gitUsername: string | null | undefined
): string | null {
  if (!settings) {
    return null
  }
  const raw = selectBranchPrefixInput(settings, gitUsername?.trim() || null)
  // Why: partial settings (and unknown strategies) yield no string, which means no own prefix.
  if (typeof raw !== 'string') {
    return null
  }
  const prefix = normalizeBranchPrefix(raw)
  return prefix && getBranchPrefixIssue(prefix) === null ? prefix : null
}

export function stripOwnBranchPrefix(branch: string, ownPrefix: string | null): string {
  if (!ownPrefix) {
    return branch
  }
  const head = `${ownPrefix}/`
  return branch.startsWith(head) && branch.length > head.length ? branch.slice(head.length) : branch
}

export type BranchLabelEntry = {
  key: string
  branch: string
  /** Rows only compete for a label inside one scope (a project, or the whole list). */
  scope: string
  ownPrefix: string | null
}

/**
 * Display label per entry key. A stripped label that two different branches would share falls
 * back to the full names, so the row never claims two branches are one.
 */
export function getBranchDisplayLabels(entries: readonly BranchLabelEntry[]): Map<string, string> {
  const stripped = entries.map((entry) => ({
    entry,
    label: stripOwnBranchPrefix(entry.branch, entry.ownPrefix)
  }))
  const branchesByLabel = new Map<string, Set<string>>()
  for (const { entry, label } of stripped) {
    const id = `${entry.scope}\0${label}`
    const branches = branchesByLabel.get(id) ?? new Set<string>()
    branches.add(entry.branch)
    branchesByLabel.set(id, branches)
  }
  const labels = new Map<string, string>()
  for (const { entry, label } of stripped) {
    const ambiguous = (branchesByLabel.get(`${entry.scope}\0${label}`)?.size ?? 0) > 1
    labels.set(entry.key, ambiguous ? entry.branch : label)
  }
  return labels
}
