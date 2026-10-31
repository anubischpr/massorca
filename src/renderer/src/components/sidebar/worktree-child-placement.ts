import {
  buildPaneKeyByTerminalHandle,
  resolveAgentRowParentPaneKey
} from '@/components/dashboard/agent-row-lineage-model'
import type { RetainedAgentEntry } from '@/store/slices/agent-status'
import { findKnownWorktreeById } from '@/store/slices/worktrees/listing/detected-worktree-meta'
import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalLayoutSnapshot, TerminalTab } from '../../../../shared/terminal-tab-types'
import { liveEntryWorktreeId } from './worktree-agent-live-index-patch'
import { entryWithRuntimeOrchestration } from './worktree-agent-row-orchestration'
import { getLiveTabIdToWorktreeId } from './worktree-agent-row-selectors'

/**
 * Where a session with a parent is listed. A session whose parent is listed in another worktree
 * appears once, under that parent, and not in its own worktree. A session without a listed parent
 * stays in its own worktree.
 */

type PlacementRecord = {
  paneKey: string
  entry: AgentStatusEntry
  /** The worktree whose list shows this session before placement. */
  ownWorktreeId: string
  kind: 'live' | 'retained'
}

type PlacementTopology = {
  /** Pane keys a worktree's own list drops, because their parent is listed in another worktree. */
  placedAwayByWorktree: ReadonlyMap<string, readonly string[]>
  /** Live sessions another worktree runs, listed under a parent in this worktree. */
  liveChildrenByWorktree: ReadonlyMap<string, readonly string[]>
  /** Retained sessions another worktree holds, listed under a parent in this worktree. */
  retainedChildrenByWorktree: ReadonlyMap<string, readonly string[]>
  /** Worktrees whose every listed session is placed away, mapped to the worktrees those sessions are placed under. */
  branchRowCandidatesByWorktree: ReadonlyMap<string, readonly string[]>
  /** Worktrees that list at least one session of their own (not placed away). */
  worktreesWithListedSessions: ReadonlySet<string>
}

/** True when the parent links from this session loop back on themselves. */
function parentChainLoops(
  start: PlacementRecord,
  records: Map<string, PlacementRecord>,
  paneKeyByTerminalHandle: ReturnType<typeof buildPaneKeyByTerminalHandle>
): boolean {
  const seen = new Set<string>([start.paneKey])
  let current = start
  for (;;) {
    const parentPaneKey = resolveAgentRowParentPaneKey(current, records, paneKeyByTerminalHandle)
    const parent = parentPaneKey === undefined ? undefined : records.get(parentPaneKey)
    if (!parent) {
      return false
    }
    if (seen.has(parent.paneKey)) {
      return true
    }
    seen.add(parent.paneKey)
    current = parent
  }
}

type TopologyCache = {
  agentStatusByPaneKey: AppState['agentStatusByPaneKey']
  retainedAgentsByPaneKey: AppState['retainedAgentsByPaneKey']
  runtimeAgentOrchestrationByPaneKey: AppState['runtimeAgentOrchestrationByPaneKey']
  tabsByWorktree: AppState['tabsByWorktree']
  unifiedTabsByWorktree: AppState['unifiedTabsByWorktree']
  topology: PlacementTopology
}

type TabIndexCache = {
  tabsByWorktree: AppState['tabsByWorktree']
  tabsById: ReadonlyMap<string, TerminalTab>
}

// Why: selector unit tests pass partial store mocks; a missing map must read as an empty slice.
const EMPTY_AGENT_STATUS: AppState['agentStatusByPaneKey'] = {}
const EMPTY_RETAINED: AppState['retainedAgentsByPaneKey'] = {}
const EMPTY_ORCHESTRATION: AppState['runtimeAgentOrchestrationByPaneKey'] = {}
const EMPTY_TABS: AppState['tabsByWorktree'] = {}

let topologyCache: TopologyCache | null = null
let tabIndexCache: TabIndexCache | null = null

function appendTo(map: Map<string, string[]>, worktreeId: string, paneKey: string): void {
  const bucket = map.get(worktreeId)
  if (bucket) {
    bucket.push(paneKey)
  } else {
    map.set(worktreeId, [paneKey])
  }
}

function buildTopology(state: AppState): PlacementTopology {
  const runtime = state.runtimeAgentOrchestrationByPaneKey ?? EMPTY_ORCHESTRATION
  const liveTabWorktreeIds = getLiveTabIdToWorktreeId(
    state.tabsByWorktree ?? EMPTY_TABS,
    state.unifiedTabsByWorktree
  )
  const records = new Map<string, PlacementRecord>()
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey ?? EMPTY_AGENT_STATUS)) {
    const ownWorktreeId = liveEntryWorktreeId(paneKey, entry, liveTabWorktreeIds)
    if (ownWorktreeId) {
      records.set(paneKey, {
        paneKey,
        entry: entryWithRuntimeOrchestration(entry, runtime),
        ownWorktreeId,
        kind: 'live'
      })
    }
  }
  for (const [paneKey, retained] of Object.entries(
    state.retainedAgentsByPaneKey ?? EMPTY_RETAINED
  )) {
    if (!records.has(paneKey)) {
      records.set(paneKey, {
        paneKey,
        entry: entryWithRuntimeOrchestration(retained.entry, runtime),
        ownWorktreeId: retained.worktreeId,
        kind: 'retained'
      })
    }
  }

  // Why: the same parent rules the lineage tree applies inside one list, over every listed session.
  const paneKeyByTerminalHandle = buildPaneKeyByTerminalHandle([...records.values()])
  const displayByPaneKey = new Map<string, string>()
  const displayOf = (record: PlacementRecord, visiting: Set<string>): string => {
    const known = displayByPaneKey.get(record.paneKey)
    if (known !== undefined) {
      return known
    }
    // Why: malformed orchestration metadata can form a cycle; keep the session where it is listed.
    if (visiting.has(record.paneKey)) {
      return record.ownWorktreeId
    }
    visiting.add(record.paneKey)
    const parentPaneKey = resolveAgentRowParentPaneKey(record, records, paneKeyByTerminalHandle)
    const parent = parentPaneKey === undefined ? undefined : records.get(parentPaneKey)
    const display = parent ? displayOf(parent, visiting) : record.ownWorktreeId
    visiting.delete(record.paneKey)
    displayByPaneKey.set(record.paneKey, display)
    return display
  }
  for (const record of records.values()) {
    displayOf(record, new Set())
  }

  const placedAway = new Map<string, string[]>()
  const liveChildren = new Map<string, string[]>()
  const retainedChildren = new Map<string, string[]>()
  const listedWorktreeIds = new Set<string>()
  const placedUnderByWorktree = new Map<string, Set<string>>()
  // Why: a worktree with a session in a parent loop keeps its row, so a cycle never hides every row it touches.
  const loopingWorktreeIds = new Set<string>()
  for (const record of records.values()) {
    const display = displayByPaneKey.get(record.paneKey) ?? record.ownWorktreeId
    if (display === record.ownWorktreeId) {
      listedWorktreeIds.add(record.ownWorktreeId)
      continue
    }
    appendTo(placedAway, record.ownWorktreeId, record.paneKey)
    appendTo(record.kind === 'live' ? liveChildren : retainedChildren, display, record.paneKey)
    if (parentChainLoops(record, records, paneKeyByTerminalHandle)) {
      loopingWorktreeIds.add(record.ownWorktreeId)
      continue
    }
    const under = placedUnderByWorktree.get(record.ownWorktreeId) ?? new Set<string>()
    under.add(display)
    placedUnderByWorktree.set(record.ownWorktreeId, under)
  }
  const branchRowCandidates = new Map<string, string[]>()
  for (const [worktreeId, under] of placedUnderByWorktree) {
    if (!listedWorktreeIds.has(worktreeId) && !loopingWorktreeIds.has(worktreeId)) {
      branchRowCandidates.set(worktreeId, [...under])
    }
  }
  return {
    placedAwayByWorktree: placedAway,
    liveChildrenByWorktree: liveChildren,
    retainedChildrenByWorktree: retainedChildren,
    branchRowCandidatesByWorktree: branchRowCandidates,
    worktreesWithListedSessions: listedWorktreeIds
  }
}

/**
 * The placement topology of one store state. Rebuilt when a map it reads changes identity, and every
 * card on the same publication shares the one build.
 */
function topologyOf(state: AppState): PlacementTopology {
  const cache = topologyCache
  if (
    cache &&
    cache.agentStatusByPaneKey === state.agentStatusByPaneKey &&
    cache.retainedAgentsByPaneKey === state.retainedAgentsByPaneKey &&
    cache.runtimeAgentOrchestrationByPaneKey === state.runtimeAgentOrchestrationByPaneKey &&
    cache.tabsByWorktree === state.tabsByWorktree &&
    cache.unifiedTabsByWorktree === state.unifiedTabsByWorktree
  ) {
    return cache.topology
  }
  const topology = buildTopology(state)
  topologyCache = {
    agentStatusByPaneKey: state.agentStatusByPaneKey,
    retainedAgentsByPaneKey: state.retainedAgentsByPaneKey,
    runtimeAgentOrchestrationByPaneKey: state.runtimeAgentOrchestrationByPaneKey,
    tabsByWorktree: state.tabsByWorktree,
    unifiedTabsByWorktree: state.unifiedTabsByWorktree,
    topology
  }
  return topology
}

function tabsByIdOf(tabsByWorktree: AppState['tabsByWorktree']): ReadonlyMap<string, TerminalTab> {
  if (tabIndexCache?.tabsByWorktree === tabsByWorktree) {
    return tabIndexCache.tabsById
  }
  const tabsById = new Map<string, TerminalTab>()
  for (const tabs of Object.values(tabsByWorktree)) {
    for (const tab of tabs) {
      tabsById.set(tab.id, tab)
    }
  }
  tabIndexCache = { tabsByWorktree, tabsById }
  return tabsById
}

/** The tab ids of the child sessions a worktree lists under a parent, live and retained. */
function crossWorktreeChildTabIds(state: AppState, worktreeId: string): string[] {
  const topology = topologyOf(state)
  const tabIds: string[] = []
  for (const paneKey of topology.liveChildrenByWorktree.get(worktreeId) ?? []) {
    const tabId = parsePaneKey(paneKey)?.tabId
    if (tabId) {
      tabIds.push(tabId)
    }
  }
  for (const paneKey of topology.retainedChildrenByWorktree.get(worktreeId) ?? []) {
    const retained = state.retainedAgentsByPaneKey[paneKey]
    if (retained) {
      tabIds.push(retained.tab.id)
    }
  }
  return tabIds
}

/** Pane keys a worktree's own list must not show, because their parent is listed in another worktree. */
export function selectPlacedAwayPaneKeysForWorktree(
  state: AppState,
  worktreeId: string
): readonly string[] {
  return topologyOf(state).placedAwayByWorktree.get(worktreeId) ?? []
}

/** Live sessions that another worktree runs and this worktree lists under a parent, as the store holds them. */
export function selectCrossWorktreeLiveChildEntries(
  state: AppState,
  worktreeId: string
): AgentStatusEntry[] {
  const paneKeys = topologyOf(state).liveChildrenByWorktree.get(worktreeId) ?? []
  return paneKeys.flatMap((paneKey) => {
    const entry = state.agentStatusByPaneKey[paneKey]
    return entry ? [entry] : []
  })
}

/** Retained sessions that another worktree holds and this worktree lists under a parent. */
export function selectCrossWorktreeRetainedChildren(
  state: AppState,
  worktreeId: string
): RetainedAgentEntry[] {
  const paneKeys = topologyOf(state).retainedChildrenByWorktree.get(worktreeId) ?? []
  return paneKeys.flatMap((paneKey) => {
    const retained = state.retainedAgentsByPaneKey[paneKey]
    return retained ? [retained] : []
  })
}

/** The current tabs of the cross-worktree child sessions; a missing tab falls back to its snapshot. */
export function selectCrossWorktreeChildTabs(state: AppState, worktreeId: string): TerminalTab[] {
  const tabsById = tabsByIdOf(state.tabsByWorktree ?? EMPTY_TABS)
  const tabs = new Map<string, TerminalTab>()
  for (const tabId of crossWorktreeChildTabIds(state, worktreeId)) {
    const tab = tabsById.get(tabId)
    if (tab) {
      tabs.set(tab.id, tab)
    }
  }
  return [...tabs.values()]
}

/** The PTY ids of the cross-worktree child tabs, so a child's liveness reads from its own tab. */
export function selectCrossWorktreeChildPtyIds(
  state: AppState,
  worktreeId: string
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const tabId of crossWorktreeChildTabIds(state, worktreeId)) {
    const ids = state.ptyIdsByTabId[tabId]
    if (ids && ids.length > 0) {
      out[tabId] = ids
    }
  }
  return out
}

/** The git branch each named worktree runs on, without its ref prefix; empty for a folder or detached head. */
export function selectChildWorktreeBranchNames(
  state: AppState,
  worktreeIds: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const worktreeId of worktreeIds) {
    const branch = findKnownWorktreeById(state, worktreeId)?.branch ?? ''
    out[worktreeId] = branch.replace(/^refs\/heads\//, '')
  }
  return out
}

/** The pane layouts of the cross-worktree child tabs, for the legacy pane-key alias check. */
export function selectCrossWorktreeChildLayouts(
  state: AppState,
  worktreeId: string
): Record<string, TerminalLayoutSnapshot | undefined> {
  const out: Record<string, TerminalLayoutSnapshot | undefined> = {}
  for (const tabId of crossWorktreeChildTabIds(state, worktreeId)) {
    out[tabId] = state.terminalLayoutsByTabId[tabId]
  }
  return out
}

/**
 * Worktrees whose listed sessions are all placed under a parent in another worktree, keyed by worktree
 * id. The value lists the worktrees those sessions are placed under. A loop in the parent links keeps
 * the worktree out of this map.
 */
export function selectBranchRowCandidatesByWorktree(
  state: AppState
): ReadonlyMap<string, readonly string[]> {
  return topologyOf(state).branchRowCandidatesByWorktree
}

/** Worktrees that list at least one session of their own, not placed under another worktree. */
export function selectWorktreeIdsWithListedSessions(state: AppState): ReadonlySet<string> {
  return topologyOf(state).worktreesWithListedSessions
}
