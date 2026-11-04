import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import {
  PROTOTYPES_TREE_COLLAPSE_KEY,
  PrototypeSidebarTree
} from '../prototypes/PrototypeSidebarTree'
import { prototypePanelsShown } from '../prototypes/prototype-panel-visibility'
import { usePrototypeViewStore } from '../prototypes/prototype-view-store'
import { usePrototypeSets } from '../prototypes/use-prototype-sets'

/**
 * The Prototypes row of the left sidebar, with its chevron and the tree of projects and sets under it. The
 * row opens the Prototypes view; the chevron only shows or hides the tree.
 */
export function SidebarPrototypesEntry(): React.JSX.Element {
  const activeView = useAppStore((s) => s.activeView)
  const openPrototypesPage = useAppStore((s) => s.openPrototypesPage)
  const collapsedGroups = useAppStore((s) => s.collapsedGroups)
  const toggleCollapsedGroup = useAppStore((s) => s.toggleCollapsedGroup)
  const listed = usePrototypeSets()
  const selectedRequestId = usePrototypeViewStore((s) => s.selectedRequestId)
  const selectedProjectKey = usePrototypeViewStore((s) => s.selectedProjectKey)
  const selectRequest = usePrototypeViewStore((s) => s.selectRequest)
  const selectDesignSystem = usePrototypeViewStore((s) => s.selectDesignSystem)
  const sidePanelHidden = usePrototypeViewStore((s) => s.sidePanelHidden)
  const listPanelHidden = usePrototypeViewStore((s) => s.listPanelHidden)
  const states = usePrototypeViewStore((s) => s.states)

  const prototypesActive = activeView === 'prototypes'
  const treeExpanded = !collapsedGroups.has(PROTOTYPES_TREE_COLLAPSE_KEY)
  // Why: a merge hides the tree only when the user hid it for that merge, from the viewer's toggle.
  const mergeUnderWay =
    selectedRequestId !== null && (states[selectedRequestId]?.merge ?? null) !== null
  const treeShown = prototypePanelsShown({ sidePanelHidden, listPanelHidden, mergeUnderWay }).list
  const Chevron = treeExpanded ? ChevronDown : ChevronRight

  // Why: the tree lives on every home view, so a click there also shows the Prototypes view.
  const openRequest = (requestId: string): void => {
    selectRequest(requestId)
    if (!prototypesActive) {
      openPrototypesPage()
    }
  }
  const openSystem = (projectKey: string): void => {
    selectDesignSystem(projectKey)
    if (!prototypesActive) {
      openPrototypesPage()
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          'group flex w-full items-center rounded-md text-[13px] font-medium tracking-tight transition-colors',
          prototypesActive
            ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
            : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
        )}
      >
        <button
          type="button"
          onClick={() => openPrototypesPage()}
          aria-current={prototypesActive ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
        >
          <LayoutGrid
            className={cn(
              'size-4 shrink-0',
              !prototypesActive && 'text-worktree-sidebar-foreground/30'
            )}
            strokeWidth={prototypesActive ? 2.25 : 1.75}
          />
          <span className="flex-1">
            {translate('components.prototypes.sidebarLabel', 'Prototypes')}
          </span>
          {listed.sets.length > 0 ? (
            <span className="rounded-full bg-worktree-sidebar-foreground/8 px-1.5 text-[11px]">
              {listed.sets.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-expanded={treeExpanded}
          aria-label={
            treeExpanded
              ? translate('components.prototypes.tree.collapse', 'Collapse prototypes')
              : translate('components.prototypes.tree.expand', 'Expand prototypes')
          }
          onClick={() => toggleCollapsedGroup(PROTOTYPES_TREE_COLLAPSE_KEY)}
          className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-worktree-sidebar-foreground/55 transition-colors hover:bg-worktree-sidebar-foreground/10 hover:text-worktree-sidebar-foreground"
        >
          <Chevron className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {treeExpanded && treeShown ? (
        <PrototypeSidebarTree
          listed={listed}
          selectedRequestId={prototypesActive ? selectedRequestId : null}
          selectedProjectKey={prototypesActive ? selectedProjectKey : null}
          collapsed={collapsedGroups}
          onToggleCollapsed={toggleCollapsedGroup}
          onOpenRequest={openRequest}
          onOpenSystem={openSystem}
          onSelectRequest={selectRequest}
        />
      ) : null}
    </div>
  )
}
