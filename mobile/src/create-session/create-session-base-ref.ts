import type { BaseRefSearchResult } from '../../../src/shared/repo-types'
import type { CreateSessionChoice } from './create-session-model'

/** The sheet row that clears a pick, so the host keeps choosing the base itself. */
export const DEFAULT_BASE_REF_VALUE = '__repository_default__'

export function baseRefChipLabel(baseRef: string | null, defaultRef: string | null): string {
  return baseRef ?? defaultRef ?? 'Default branch'
}

function describeRef(ref: BaseRefSearchResult): string {
  // A remote ref names its remote and differs from the local branch it would create.
  return ref.refName === ref.localBranchName ? 'Local branch' : 'Remote branch'
}

export function buildBaseRefChoices(args: {
  refs: readonly BaseRefSearchResult[]
  query: string
  defaultRef: string | null
}): CreateSessionChoice[] {
  const rows = args.refs.map((ref) => ({
    value: ref.refName,
    label: ref.refName,
    description: ref.refName === args.defaultRef ? 'Default base branch' : describeRef(ref)
  }))
  if (args.query.trim() !== '') {
    return rows
  }
  return [
    {
      value: DEFAULT_BASE_REF_VALUE,
      label: args.defaultRef ?? 'Default branch',
      description: 'Where this repository starts new worktrees'
    },
    ...rows.filter((row) => row.value !== args.defaultRef)
  ]
}
