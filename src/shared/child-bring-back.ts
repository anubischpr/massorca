import { z } from 'zod'

export const CHILD_BRING_BACK_BLOCKS = [
  'parent-uncommitted',
  'parent-working',
  'parent-no-branch'
] as const

/** What the parent's access lets Bring back do unasked. Bot teams will pass `full`. */
export type ChildBringBackPolicy = 'ask' | 'auto' | 'full'

export const CHILD_BRING_BACK_AUTOMATIC_STATES = ['waiting', 'asked-commit', 'undone'] as const

export const ChildBringBackStatus = z.discriminatedUnion('kind', [
  // Folder workspace, child in the parent's worktree, or anything the host cannot read: no control.
  z.object({ kind: z.literal('unavailable') }),
  z.object({ kind: z.literal('running') }),
  z.object({ kind: z.literal('gone') }),
  z.object({ kind: z.literal('nothing'), childUncommitted: z.number() }),
  z.object({
    kind: z.literal('ready'),
    commits: z.number(),
    files: z.number(),
    into: z.string(),
    parentAhead: z.number(),
    childUncommitted: z.number(),
    childWorktreeRemoved: z.boolean(),
    /** Null when Git predates `merge-tree --write-tree` or the merge is blocked anyway. */
    predictedConflicts: z.number().nullable(),
    block: z.enum(CHILD_BRING_BACK_BLOCKS).nullable(),
    parentUncommitted: z.number(),
    // Optional on all three: an older host sends none, and an older client strips them.
    automatic: z.enum(CHILD_BRING_BACK_AUTOMATIC_STATES).optional()
  }),
  z.object({
    kind: z.literal('conflicts'),
    unresolved: z.number(),
    agentResolving: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('brought-back'),
    into: z.string(),
    commit: z.string(),
    automatically: z.boolean().optional()
  })
])
export type ChildBringBackStatus = z.infer<typeof ChildBringBackStatus>

export type ChildBringBackLine = {
  id: string
  template: string
  params?: Record<string, string | number>
}

export type ChildBringBackView = {
  meta: ChildBringBackLine[]
  warnings: ChildBringBackLine[]
  /** Absent when the state offers no merge. */
  action: { enabled: boolean } | null
  conflicts: { unresolved: number; agentResolving: boolean } | null
  /** False once the child's worktree is gone, so Open child chat has nothing to open. */
  childOpenable: boolean
}

function counted(id: string, count: number, one: string, many: string): ChildBringBackLine {
  return { id, template: count === 1 ? one : many, params: { count } }
}

function warning(id: string, template: string, count?: number): ChildBringBackLine {
  return {
    id,
    template,
    ...(count === undefined ? {} : { params: { count } })
  }
}

function uncommittedInChild(count: number): ChildBringBackLine {
  return count === 1
    ? warning(
        'childOnlyUncommittedOne',
        '1 uncommitted file in the child. Nothing to bring back until it is committed.'
      )
    : warning(
        'childOnlyUncommitted',
        '{{count}} uncommitted files in the child. Nothing to bring back until they are committed.',
        count
      )
}

function readyWarnings(
  status: Extract<ChildBringBackStatus, { kind: 'ready' }>
): ChildBringBackLine[] {
  if (status.automatic === 'waiting') {
    return [warning('automaticWaiting', 'Will bring back when the parent session stops.')]
  }
  if (status.automatic === 'asked-commit') {
    return [warning('automaticAskedCommit', 'Asked the parent session to commit first.')]
  }
  switch (status.block) {
    case 'parent-uncommitted':
      return [
        status.parentUncommitted === 1
          ? warning('parentUncommittedOne', 'The parent has 1 uncommitted file. Commit it first.')
          : warning(
              'parentUncommitted',
              'The parent has {{count}} uncommitted files. Commit them first.',
              status.parentUncommitted
            )
      ]
    case 'parent-working':
      return [warning('parentWorking', 'The parent session is working. Try when it stops.')]
    case 'parent-no-branch':
      return [
        warning(
          'parentNoBranch',
          'The parent has no branch checked out, or a merge or rebase is running.'
        )
      ]
    case null:
      break
  }
  return [
    ...(status.automatic === 'undone'
      ? [warning('automaticUndone', 'Merging hit conflicts, so it was undone.')]
      : []),
    ...(status.childWorktreeRemoved
      ? [warning('worktreeRemoved', 'The child worktree was removed. Its branch is kept.')]
      : []),
    ...(status.childUncommitted === 1
      ? [warning('childUncommittedOne', '1 uncommitted file stays in the child.')]
      : status.childUncommitted > 1
        ? [
            warning(
              'childUncommitted',
              '{{count}} uncommitted files stay in the child.',
              status.childUncommitted
            )
          ]
        : []),
    ...(status.predictedConflicts === 1
      ? [warning('predictedConflictOne', 'Will conflict in 1 file. You can abort.')]
      : status.predictedConflicts !== null && status.predictedConflicts > 1
        ? [
            warning(
              'predictedConflict',
              'Will conflict in {{count}} files. You can abort.',
              status.predictedConflicts
            )
          ]
        : [])
  ]
}

/** What the notice draws for a status; desktop and phone share it so their words cannot drift. */
export function childBringBackView(status: ChildBringBackStatus): ChildBringBackView {
  const empty: ChildBringBackView = {
    meta: [],
    warnings: [],
    action: null,
    conflicts: null,
    childOpenable: true
  }
  switch (status.kind) {
    case 'unavailable':
    case 'running':
      return empty
    case 'gone':
      return {
        ...empty,
        warnings: [warning('gone', 'The child worktree and branch were removed.')],
        childOpenable: false
      }
    case 'nothing':
      return status.childUncommitted > 0
        ? { ...empty, warnings: [uncommittedInChild(status.childUncommitted)] }
        : empty
    case 'conflicts':
      return {
        ...empty,
        warnings: status.agentResolving
          ? [warning('automaticResolving', 'The parent session is resolving these.')]
          : [],
        conflicts: { unresolved: status.unresolved, agentResolving: status.agentResolving === true }
      }
    case 'brought-back':
      return {
        ...empty,
        meta: [
          {
            id: status.automatically ? 'broughtBackAutomatically' : 'broughtBack',
            template: status.automatically
              ? 'Brought back automatically into {{into}} · {{commit}}'
              : 'Brought back into {{into}} · {{commit}}',
            params: { into: status.into, commit: status.commit }
          }
        ]
      }
    case 'ready':
      return {
        meta: [
          counted('commits', status.commits, '1 commit', '{{count}} commits'),
          counted('files', status.files, '1 file', '{{count}} files'),
          ...(status.into
            ? [
                {
                  id: 'into',
                  template: 'into {{into}}',
                  params: { into: status.into }
                }
              ]
            : []),
          ...(status.parentAhead > 0
            ? [
                counted(
                  'parentAhead',
                  status.parentAhead,
                  'parent has 1 new commit',
                  'parent has {{count}} new commits'
                )
              ]
            : [])
        ],
        warnings: readyWarnings(status),
        // Waiting and asked-commit clear by themselves, so they offer nothing to click.
        action:
          status.automatic === 'waiting' || status.automatic === 'asked-commit'
            ? null
            : { enabled: status.block === null },
        conflicts: null,
        childOpenable: !status.childWorktreeRemoved
      }
  }
}

export function interpolateChildBringBackLine(line: ChildBringBackLine): string {
  return line.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(line.params?.[key] ?? '')
  )
}
