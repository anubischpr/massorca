import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Palette } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  activePrototypeSets,
  archivedPrototypeSets,
  requestToOpenAfterArchiving
} from '../../../../shared/prototype-archived-sets'
import {
  buildPrototypeListGroups,
  type PrototypeListGroup
} from '../../../../shared/prototype-list-groups'
import { buildPrototypeListRows } from '../../../../shared/prototype-list-model'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeArchivedGroup, type PrototypeArchiveControls } from './PrototypeArchivedGroup'
import { PrototypeSetRow } from './PrototypeSetRow'
import { prototypeTargetForSession } from './prototype-host-targets'
import {
  prototypeHostKey,
  runPrototypeSetAction,
  type PrototypeSetAction
} from './prototype-set-actions'
import { usePrototypeViewStore } from './prototype-view-store'
import type { PrototypeSetsResult } from './use-prototype-sets'
import { prototypeSystemLine } from './prototype-labels'

/** The app's collapsed-group key of the tree under the Prototypes row. */
export const PROTOTYPES_TREE_COLLAPSE_KEY = 'prototypes-tree'

function projectCollapseKey(projectKey: string): string {
  return `prototypes-project:${projectKey}`
}

/**
 * The Prototypes tree under the Prototypes row of the left sidebar: one group per project (its name, its
 * design system row, then its sets, newest first), then the Archived group. Selection and navigation are
 * the parent's; the tree only reports them.
 */
export function PrototypeSidebarTree({
  listed,
  selectedRequestId,
  selectedProjectKey,
  collapsed,
  onToggleCollapsed,
  onOpenRequest,
  onOpenSystem,
  onSelectRequest
}: {
  listed: PrototypeSetsResult
  /** The set to mark as selected; null while another view is open. */
  selectedRequestId: string | null
  /** The design system to mark as selected; null while another view is open. */
  selectedProjectKey: string | null
  /** The app's collapsed-group keys: a project's key hides its design system row and sets. */
  collapsed: ReadonlySet<string>
  onToggleCollapsed: (key: string) => void
  /** A click on a set: selects it and shows the Prototypes view. */
  onOpenRequest: (requestId: string) => void
  /** A click on a design system row: selects it and shows the Prototypes view. */
  onOpenSystem: (projectKey: string) => void
  /** Selects a set without changing the view, for the neighbor an archived set leaves behind. */
  onSelectRequest: (requestId: string | null) => void
}): React.JSX.Element {
  const states = usePrototypeViewStore((s) => s.states)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  // Why split: an archived set leaves the main list and its counts, and opens from the Archived group.
  const activeSets = useMemo(() => activePrototypeSets(listed.sets), [listed.sets])
  const archivedSets = useMemo(() => archivedPrototypeSets(listed.sets), [listed.sets])
  const rows = useMemo(
    () =>
      buildPrototypeListRows({
        sets: activeSets,
        // Why 'all': the desktop tree has no agent filter; the phone's list still offers one.
        filter: 'all',
        activeLetterOf: (requestId) => states[requestId]?.active,
        nowMs
      }),
    [activeSets, states, nowMs]
  )
  const archivedRows = useMemo(
    () =>
      buildPrototypeListRows({
        sets: archivedSets,
        filter: 'all',
        activeLetterOf: (requestId) => states[requestId]?.active,
        nowMs
      }),
    [archivedSets, states, nowMs]
  )
  const groups = useMemo(
    () => buildPrototypeListGroups({ sets: activeSets, rows, designSystems: listed.designSystems }),
    [activeSets, listed.designSystems, rows]
  )
  // Hosts that answered an archive action with method_not_found: their sets are not offered the actions.
  const [outdatedHosts, setOutdatedHosts] = useState<ReadonlySet<string>>(() => new Set())

  const runSetAction = async (
    action: PrototypeSetAction,
    set: PrototypeListedSet
  ): Promise<void> => {
    const outcome = await runPrototypeSetAction(action, set)
    if (outcome === 'unsupported') {
      const hostKey = prototypeHostKey(prototypeTargetForSession(set.sessionId))
      setOutdatedHosts((previous) => new Set(previous).add(hostKey))
    }
    listed.reload()
  }
  const archive: PrototypeArchiveControls = {
    rows: archivedRows,
    supports: (set) =>
      !outdatedHosts.has(prototypeHostKey(prototypeTargetForSession(set.sessionId))),
    onArchive: (set) => {
      if (set.requestId === selectedRequestId) {
        // Why: the open set leaves the main list, so the view moves to its neighbor instead of keeping a hidden one.
        onSelectRequest(
          requestToOpenAfterArchiving(
            groups.flatMap((group) => group.rows),
            set.requestId
          )
        )
      }
      void runSetAction('archive', set)
    },
    onUnarchive: (set) => void runSetAction('unarchive', set),
    onDelete: (set) => void runSetAction('delete', set)
  }

  return (
    <div
      role="group"
      aria-label={translate('components.prototypes.listLabel', 'All prototypes')}
      className="flex flex-col gap-0.5 pb-1 pl-4"
    >
      {groups.map((group) => (
        <TreeGroup
          key={group.projectKey ?? 'unprojected'}
          group={group}
          selectedRequestId={selectedRequestId}
          selectedProjectKey={selectedProjectKey}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
          onOpenRequest={onOpenRequest}
          onOpenSystem={onOpenSystem}
          archive={archive}
        />
      ))}
      <PrototypeArchivedGroup
        controls={archive}
        selectedRequestId={selectedRequestId}
        onSelect={onOpenRequest}
      />
    </div>
  )
}

// One project: its name as a collapsible header, then its design system row and its sets.
function TreeGroup({
  group,
  selectedRequestId,
  selectedProjectKey,
  collapsed,
  onToggleCollapsed,
  onOpenRequest,
  onOpenSystem,
  archive
}: {
  group: PrototypeListGroup
  selectedRequestId: string | null
  selectedProjectKey: string | null
  collapsed: ReadonlySet<string>
  onToggleCollapsed: (key: string) => void
  onOpenRequest: (requestId: string) => void
  onOpenSystem: (projectKey: string) => void
  archive: PrototypeArchiveControls
}): React.JSX.Element {
  const { projectKey, projectName, system, rows } = group
  const expanded =
    projectKey === null || projectName === null || !collapsed.has(projectCollapseKey(projectKey))
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <div className="flex flex-col gap-0.5">
      {projectKey === null || projectName === null ? null : (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onToggleCollapsed(projectCollapseKey(projectKey))}
          className="flex items-center gap-1 px-2 pt-2 pb-1 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          <Chevron className="size-3" aria-hidden="true" />
          {projectName}
        </button>
      )}
      {expanded && projectKey !== null && system !== null ? (
        <>
          <SystemRow
            system={system}
            selected={selectedProjectKey === projectKey}
            onSelect={() => onOpenSystem(projectKey)}
          />
          <div role="separator" className="mx-2 my-0.5 h-px bg-border" />
        </>
      ) : null}
      {expanded
        ? rows.map((row) => (
            <PrototypeSetRow
              key={row.set.requestId}
              row={row}
              selected={row.set.requestId === selectedRequestId}
              onSelect={() => onOpenRequest(row.set.requestId)}
              {...(archive.supports(row.set)
                ? { onArchive: () => archive.onArchive(row.set) }
                : {})}
            />
          ))
        : null}
    </div>
  )
}

// The design system row of a project: a Palette icon, its name, and its status as a tooltip.
function SystemRow({
  system,
  selected,
  onSelect
}: {
  system: PrototypeListedDesignSystem
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
            selected
              ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
              : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
          )}
        >
          <Palette className="size-4 shrink-0 text-status-amber" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">
            {translate('components.prototypes.list.designSystem', 'Design system')}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {prototypeSystemLine(system)}
      </TooltipContent>
    </Tooltip>
  )
}
