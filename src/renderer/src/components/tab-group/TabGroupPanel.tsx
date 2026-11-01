import { Suspense, useCallback, useMemo } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { useDroppable } from '@dnd-kit/core'
import { useTabGroupWorkspaceModel } from './useTabGroupWorkspaceModel'
import { getTabPaneBodyDroppableId } from './useTabDragSplit'
import { tabGroupBodyAnchorName } from './tab-group-body-anchor'
import { registerTabGroupBody } from './tab-group-body-geometry'
import { translate } from '@/i18n/i18n'
import { useEditorGroupFileDropOwner } from '../editor/use-editor-group-file-drop-owner'

const EditorPanel = lazy(() => import('../editor/EditorPanel'))

export default function TabGroupPanel({
  groupId,
  worktreeId,
  isVisible,
  isFocused,
  hasSplitGroups,
  markdownAnnotationsEnabled = true,
  touchesRightEdge,
  touchesLeftEdge,
  touchesBottomEdge = false,
  suppressLeftBorder = false,
  suppressRightBorder = false,
  suppressBottomBorder = false,
  isTabDragActive = false
}: {
  groupId: string
  worktreeId: string
  isVisible: boolean
  isFocused: boolean
  hasSplitGroups: boolean
  /** Off for scratch workspaces (the floating panel) whose markdown is not a review surface. */
  markdownAnnotationsEnabled?: boolean
  touchesRightEdge: boolean
  touchesLeftEdge: boolean
  touchesBottomEdge?: boolean
  suppressLeftBorder?: boolean
  suppressRightBorder?: boolean
  suppressBottomBorder?: boolean
  isTabDragActive?: boolean
}): React.JSX.Element {
  const model = useTabGroupWorkspaceModel({ groupId, worktreeId })
  const { activeTab, commands } = model
  const { setNodeRef: setBodyDropRef } = useDroppable({
    id: getTabPaneBodyDroppableId(groupId),
    data: {
      kind: 'pane-body',
      groupId,
      worktreeId
    },
    disabled: !isTabDragActive
  })
  const setBodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      setBodyDropRef(node)
      if (!node) {
        return undefined
      }
      const unregisterBody = registerTabGroupBody(groupId, node)
      return () => {
        unregisterBody()
        setBodyDropRef(null)
      }
    },
    [groupId, setBodyDropRef]
  )
  const attachEditorFileDropOwner = useEditorGroupFileDropOwner({ worktreeId, groupId })
  // Why: per-group anchor-name lets the worktree-level overlay position panes via CSS anchor positioning, so moving a tab between groups re-targets the anchor instead of remounting xterm (loses alt-screen TUI state) or reloading `<webview>`.
  const bodyAnchorName = tabGroupBodyAnchorName(groupId)
  // Why: memoize so a fresh style object each render doesn't break downstream memoization keyed on referential equality.
  const bodyAnchorStyle = useMemo(
    () => ({ anchorName: bodyAnchorName }) as React.CSSProperties,
    [bodyAnchorName]
  )

  return (
    <div
      // Why: vertical borders stay `border-border` so the focus highlight (--accent ~#f5f5f5 in light) doesn't paint a near-white strip by the resize handle; only the bottom border changes on focus.
      // Why: unfocused split groups dim subtly so the focused one reads as selected; only when hasSplitGroups since a lone group has nothing to contrast against.
      className={`group/tab-group relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden${
        hasSplitGroups
          ? // Why: skip border-l/border-r on edge-touching groups; the split-layout wrapper and right sidebar already paint borders at those seams (double line otherwise).
            ` ${
              touchesLeftEdge || suppressLeftBorder ? '' : 'border-l'
            } ${touchesRightEdge || suppressRightBorder ? '' : 'border-r'} ${
              touchesBottomEdge || suppressBottomBorder ? '' : 'border-b'
            } border-border ${
              isFocused && !touchesBottomEdge && !suppressBottomBorder ? 'border-b-accent' : ''
            } ${isFocused ? '' : 'opacity-95'}`
          : ''
      }`}
      onPointerDown={commands.focusGroup}
      // Why: keyboard/AT focus can enter a split group without a pointer event, so sync group focus to DOM focus for global shortcuts.
      onFocusCapture={commands.focusGroup}
    >
      <div
        ref={setBodyRef}
        data-tab-group-body-id={groupId}
        data-worktree-id={worktreeId}
        className="relative flex-1 min-h-0 overflow-hidden"
        style={bodyAnchorStyle}
      >
        {/* Why: empty anchor so the agent-sessions tour reads as a terminal-area tip, not toolbar chrome. */}
        {isFocused ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/4 h-px"
            data-contextual-tour-target="workspace-agent-terminal-tip"
          />
        ) : null}
        {activeTab &&
          activeTab.contentType !== 'terminal' &&
          activeTab.contentType !== 'agent-session' &&
          activeTab.contentType !== 'browser' &&
          activeTab.contentType !== 'simulator' && (
            // Why: a capture-phase owner, so Monaco never sees the drop and the file opens as a tab here.
            <div ref={attachEditorFileDropOwner} className="absolute inset-0 flex min-h-0 min-w-0">
              {/* Why: split groups render editor content in a plain relative pane body, not the legacy Terminal.tsx flex column. */}
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    {translate(
                      'auto.components.tab.group.TabGroupPanel.814fb04c43',
                      'Loading editor...'
                    )}
                  </div>
                }
              >
                <EditorPanel
                  activeFileId={activeTab.entityId}
                  activeViewStateId={activeTab.id}
                  isVisible={isVisible}
                  isCmdSaveOwner={isFocused}
                  markdownAnnotationsEnabled={markdownAnnotationsEnabled}
                />
              </Suspense>
            </div>
          )}

        {/* Why: terminal/browser/simulator/structured-chat panes render at the worktree level; tab activation only changes overlay visibility and never remounts a live surface. */}
      </div>
    </div>
  )
}
