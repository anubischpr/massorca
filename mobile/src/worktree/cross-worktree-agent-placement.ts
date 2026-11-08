import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { displayBranchName } from './branch-row-label'
import { applyMobileWorkspaceLineage } from './mobile-workspace-lineage'
import type { Section, Worktree } from './workspace-list-types'
import { getWorktreeRowIdentity } from './worktree-host-row-identity'

/**
 * The worktree a session runs in, when the list shows it under a parent in another worktree. The
 * branch is null for a folder or a detached HEAD, which name no branch.
 */
export type AgentRunOwner<T = Worktree> = { item: T; branch: string | null }

export type CrossWorktreeAgentPlacement = {
  /** The sections, with each session listed once: under the worktree its parent chain ends in. */
  sections: Section[]
  /** Each session listed away from its own worktree, by pane key. */
  ownersByPaneKey: ReadonlyMap<string, AgentRunOwner>
  /** Worktree rows whose every session is listed under another worktree's parent. Pinned rows still show. */
  hiddenIdentities: ReadonlySet<string>
}

type AgentSource = { row: RuntimeWorktreeAgentRow; item: Worktree; identity: string }

/**
 * Places each session whose parent is listed in another worktree under that parent, across every
 * section of one render. Follows the desktop rules: a session goes where its parent chain ends, a
 * cycle keeps the session where it is listed, and a session with no listed parent stays in its own
 * worktree. A worktree listed twice (pinned and grouped) takes its children only once.
 *
 * `allWorktrees` are every worktree the host lists, as desktop places from the whole store: a child
 * row that a filter or a folded lineage keeps out of the list still has its session placed under
 * a listed parent, instead of disappearing from both.
 */
export function placeCrossWorktreeAgents(
  sections: readonly Section[],
  allWorktrees: readonly Worktree[] = []
): CrossWorktreeAgentPlacement {
  const sources = new Map<string, AgentSource>()
  const listedIdentities = new Set<string>()
  const addSources = (item: Worktree): void => {
    const identity = getWorktreeRowIdentity(item)
    for (const row of item.agents ?? []) {
      if (!sources.has(row.paneKey)) {
        sources.set(row.paneKey, { row, item, identity })
      }
    }
  }
  for (const section of sections) {
    for (const item of section.data) {
      listedIdentities.add(getWorktreeRowIdentity(item))
      addSources(item)
    }
  }
  for (const item of allWorktrees) {
    if (!item.isArchived) {
      addSources(item)
    }
  }

  const displayByPaneKey = new Map<string, string>()
  const displayOf = (paneKey: string, visiting: ReadonlySet<string>): string => {
    const source = sources.get(paneKey)
    if (!source) {
      return ''
    }
    const known = displayByPaneKey.get(paneKey)
    if (known !== undefined) {
      return known
    }
    // Why: a session that loops back into its own chain stays in the worktree it is listed in.
    if (visiting.has(paneKey)) {
      return source.identity
    }
    const parentKey = source.row.parentPaneKey
    const display =
      parentKey && parentKey !== paneKey && sources.has(parentKey)
        ? displayOf(parentKey, new Set([...visiting, paneKey]))
        : source.identity
    displayByPaneKey.set(paneKey, display)
    return display
  }

  const ownersByPaneKey = new Map<string, AgentRunOwner>()
  const incomingByIdentity = new Map<string, RuntimeWorktreeAgentRow[]>()
  for (const [paneKey, source] of sources) {
    const display = displayOf(paneKey, new Set())
    // Why: a parent that is not listed would take the session with it, so the session stays home.
    if (display === source.identity || !listedIdentities.has(display)) {
      continue
    }
    ownersByPaneKey.set(paneKey, { item: source.item, branch: runBranchOf(source.item) })
    const incoming = incomingByIdentity.get(display)
    if (incoming) {
      incoming.push(source.row)
    } else {
      incomingByIdentity.set(display, [source.row])
    }
  }

  // Why: a loop in the parent links keeps its rows, as the desktop sidebar does, so no loop hides every row.
  const loopingPaneKeys = new Set<string>()
  for (const paneKey of sources.keys()) {
    if (parentLinkLoops(paneKey, sources)) {
      loopingPaneKeys.add(paneKey)
    }
  }
  const hiddenIdentities = new Set<string>()
  for (const section of sections) {
    for (const item of section.data) {
      const identity = getWorktreeRowIdentity(item)
      const own = item.agents ?? []
      const kept = own.filter((row) => !ownersByPaneKey.has(row.paneKey))
      if (
        own.length > 0 &&
        kept.length === 0 &&
        !own.some((row) => loopingPaneKeys.has(row.paneKey))
      ) {
        hiddenIdentities.add(identity)
      }
    }
  }

  const attached = new Set<string>()
  const placed: Section[] = sections.map((section) => ({
    ...section,
    data: section.data.map((item) => {
      const identity = getWorktreeRowIdentity(item)
      const agents = item.agents ?? []
      const kept = agents.filter((row) => !ownersByPaneKey.has(row.paneKey))
      const incoming = attached.has(identity) ? [] : (incomingByIdentity.get(identity) ?? [])
      attached.add(identity)
      if (kept.length === agents.length && incoming.length === 0) {
        return item
      }
      return {
        ...item,
        agents: [...kept, ...incoming].sort((a, b) => a.stateStartedAt - b.stateStartedAt)
      }
    })
  }))
  return { sections: placed, ownersByPaneKey, hiddenIdentities }
}

function parentLinkLoops(start: string, sources: ReadonlyMap<string, AgentSource>): boolean {
  const seen = new Set<string>([start])
  let current = start
  for (;;) {
    const parentKey = sources.get(current)?.row.parentPaneKey
    if (!parentKey || parentKey === current || !sources.has(parentKey)) {
      return false
    }
    if (seen.has(parentKey)) {
      return true
    }
    seen.add(parentKey)
    current = parentKey
  }
}

/**
 * Drops the hidden worktree rows from each section, except the pinned section, and lays the lineage out
 * again, so a row whose lineage parent is hidden comes back at top level.
 */
export function arrangeBranchRowSections(
  sections: readonly Section[],
  placement: Pick<CrossWorktreeAgentPlacement, 'hiddenIdentities'>,
  collapsedGroups: ReadonlySet<string>
): Section[] {
  const { hiddenIdentities } = placement
  if (hiddenIdentities.size === 0) {
    return [...sections]
  }
  return sections.map((section) => {
    const shown = section.data.filter(
      (item) => section.key === 'pinned' || !hiddenIdentities.has(getWorktreeRowIdentity(item))
    )
    return { ...section, data: applyMobileWorkspaceLineage(shown, collapsedGroups) }
  })
}

function runBranchOf(item: Worktree): string | null {
  if (item.workspaceKind === 'folder-workspace') {
    return null
  }
  const branch = displayBranchName(item.branch)
  return branch.length > 0 ? branch : null
}
