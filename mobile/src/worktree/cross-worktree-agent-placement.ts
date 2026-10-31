import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { displayBranchName } from './branch-row-label'
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
}

type AgentSource = { row: RuntimeWorktreeAgentRow; item: Worktree; identity: string }

/**
 * Places each session whose parent is listed in another worktree under that parent, across every
 * section of one render. Follows the desktop rules: a session goes where its parent chain ends, a
 * cycle keeps the session where it is listed, and a session with no listed parent stays in its own
 * worktree. A worktree listed twice (pinned and grouped) takes its children only once.
 */
export function placeCrossWorktreeAgents(
  sections: readonly Section[]
): CrossWorktreeAgentPlacement {
  const sources = new Map<string, AgentSource>()
  for (const section of sections) {
    for (const item of section.data) {
      const identity = getWorktreeRowIdentity(item)
      for (const row of item.agents ?? []) {
        if (!sources.has(row.paneKey)) {
          sources.set(row.paneKey, { row, item, identity })
        }
      }
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
    if (display === source.identity) {
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
  return { sections: placed, ownersByPaneKey }
}

function runBranchOf(item: Worktree): string | null {
  if (item.workspaceKind === 'folder-workspace') {
    return null
  }
  const branch = displayBranchName(item.branch)
  return branch.length > 0 ? branch : null
}
