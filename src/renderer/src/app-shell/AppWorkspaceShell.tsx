import { Suspense, useRef } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { translate } from '@/i18n/i18n'
import Sidebar from '../components/Sidebar'
import RightSidebar from '../components/right-sidebar'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'
import { FloatingTerminalToggleButton } from '../components/floating-terminal/FloatingTerminalToggleButton'
import { TerminalWorkbenchContainer } from '../components/TerminalWorkbenchContainer'
import type { VirtualizedScrollAnchor } from '../hooks/useVirtualizedScrollAnchor'
import { useAppStore } from '../store'
import { AppRail } from './AppRail'
import { AppStatusBarSlot } from './AppStatusBarSlot'
import { TitlebarLeftControls } from './TitlebarLeftControls'
import { PageTopBand } from './PageTopBand'
import { hasCustomTitleBar } from './app-window-chrome'
import { SessionBar } from './SessionBar'
import {
  SplitTopBarChromeProvider,
  selectMainAreaSplit,
  type SplitTopBarChrome
} from './split-top-bar-chrome'
import type { AppChromeLayout } from './use-app-chrome-layout'
import type { FloatingWorkspacePanelState } from './use-floating-workspace-panel'
import { submitCreateChatDraft } from '../components/create-chat/create-chat-submit'

const Landing = lazy(() => import('../components/Landing'))
const WorktreeCreationPanel = lazy(
  () => import('../components/worktree-creation/WorktreeCreationPanel')
)
const TaskPage = lazy(() => import('../components/task-page/TaskPage'))
const TasksHomePage = lazy(() => import('../components/tasks-home/TasksHomePage'))
const AutomationsPage = lazy(() => import('../components/automations/AutomationsPage'))
const ActivityPrototypePage = lazy(() => import('../components/activity/ActivityPrototypePage'))
const Settings = lazy(() => import('../components/settings/Settings'))
const SkillsPage = lazy(() => import('../components/skills/SkillsPage'))
const ArtifactsPage = lazy(() => import('../components/artifacts/ArtifactsPage'))
const PrototypesPage = lazy(() => import('../components/prototypes/PrototypesPage'))
const BotTeamsPage = lazy(() => import('../components/bot-teams/BotTeamsPage'))
const WorkspaceSpacePage = lazy(() => import('../components/workspace-space/WorkspaceSpacePage'))
const MobilePage = lazy(() => import('../components/mobile/MobilePage'))
const CalendarPage = lazy(() => import('../components/calendar/CalendarPage'))
const CreateChatPage = lazy(() => import('../components/create-chat/CreateChatPage'))
const Terminal = lazy(() => import('../components/Terminal'))

type WorktreeSidebarScrollRefs = {
  scrollOffsetRef: React.MutableRefObject<number>
  scrollAnchorRef: React.MutableRefObject<VirtualizedScrollAnchor>
}

function WorktreeSidebar({
  layout,
  scrollRefs
}: {
  layout: AppChromeLayout
  scrollRefs: WorktreeSidebarScrollRefs
}): React.JSX.Element {
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="sidebar.worktrees"
      surface="sidebar"
      resetKey={layout.activeView}
      title={translate('auto.App.1468601e7b', 'The workspace list hit an error.')}
      description={
        layout.leftTitlebarChromeLayout.shouldMount
          ? translate(
              'auto.App.bdc71dddc9',
              'The active workspace remains open. Retry the list or switch views.'
            )
          : translate(
              'auto.App.cba0fafda5',
              'The active page remains open. Retry the list or switch views.'
            )
      }
    >
      <Sidebar
        worktreeScrollOffsetRef={scrollRefs.scrollOffsetRef}
        worktreeScrollAnchorRef={scrollRefs.scrollAnchorRef}
      />
    </RecoverableRenderErrorBoundary>
  )
}

function ActivePage({ layout }: { layout: AppChromeLayout }): React.JSX.Element {
  const { activeView, activeWorktreeId, activePendingCreationId, creationLayoutActive } = layout
  const tasksHomeOpen = useAppStore((s) => s.tasksHomeOpen)
  const botTeamsSelection = useAppStore((s) => s.botTeamsSelection)
  const setBotTeamsSelection = useAppStore((s) => s.setBotTeamsSelection)
  return (
    <>
      {activeView === 'settings' ? <Settings /> : null}
      {activeView === 'skills' ? <SkillsPage /> : null}
      {activeView === 'artifacts' ? <ArtifactsPage /> : null}
      {activeView === 'prototypes' ? <PrototypesPage /> : null}
      {activeView === 'bot-teams' ? (
        <BotTeamsPage selection={botTeamsSelection} onSelectionChange={setBotTeamsSelection} />
      ) : null}
      {activeView === 'tasks' ? tasksHomeOpen ? <TasksHomePage /> : <TaskPage /> : null}
      {activeView === 'automations' ? <AutomationsPage /> : null}
      {activeView === 'activity' ? <ActivityPrototypePage /> : null}
      {activeView === 'space' ? <WorkspaceSpacePage /> : null}
      {activeView === 'mobile' ? <MobilePage /> : null}
      {activeView === 'calendar' ? <CalendarPage /> : null}
      {activeView === 'create-chat' ? <CreateChatPage onSubmit={submitCreateChatDraft} /> : null}
      {activeView === 'terminal' && creationLayoutActive && activePendingCreationId ? (
        <WorktreeCreationPanel
          creationId={activePendingCreationId}
          reserveCollapsedSidebarHeaderSpace={layout.leftTitlebarChromeLayout.isFloating}
        />
      ) : null}
      {activeView === 'terminal' && !activeWorktreeId && !creationLayoutActive ? <Landing /> : null}
    </>
  )
}

/** The rail, left sidebar, page/workbench content area and right sidebar; no title bar spans them. */
export function AppWorkspaceShell(props: {
  layout: AppChromeLayout
  floatingWorkspace: FloatingWorkspacePanelState
}): React.JSX.Element {
  const { layout, floatingWorkspace } = props
  const titlebarLeftControls = <TitlebarLeftControls layout={layout} />
  // Why: keep virtualized scroll memory above the sidebar's workspace/landing remount so the left list doesn't restart at scrollTop 0.
  const scrollOffsetRef = useRef(0)
  const scrollAnchorRef = useRef<VirtualizedScrollAnchor>(null)
  const sidebarScrollRefs = { scrollOffsetRef, scrollAnchorRef }
  // Why: a split draws each top pane's own top row, so the window session bar is not mounted then.
  const mainAreaSplit = useAppStore(
    (s) => layout.activeWorktreeId !== null && selectMainAreaSplit(s, layout.activeWorktreeId)
  )
  const topBarsActive =
    layout.workspaceChromeActive && layout.activeWorktreeId !== null && mainAreaSplit
  const collapsePane =
    layout.showTitlebarExpandButton && layout.effectiveActiveTabId
      ? { tabId: layout.effectiveActiveTabId, canExpand: layout.activeTabCanExpand }
      : null
  const splitTopBarChrome: SplitTopBarChrome | null =
    topBarsActive && layout.activeWorktreeId
      ? {
          worktreeId: layout.activeWorktreeId,
          reserveWindowControls: hasCustomTitleBar && !layout.rightSidebarOpen,
          reserveCollapsedSidebarHeader:
            layout.leftTitlebarChromeLayout.isFloating && !layout.sidebarOpen,
          collapsePane
        }
      : null

  return (
    // Why: workspace activation is a hot path; activeWorktreeId in reset keys would remount whole surfaces during wake.
    <RecoverableRenderErrorBoundary
      boundaryId="app.workspace-shell"
      surface="workspace-shell"
      resetKey={layout.activeView}
      title={translate('auto.App.df1d56bf87', 'The workspace shell hit an error.')}
      description={translate(
        'auto.App.8504ddf267',
        'The app is still running. Retry the shell or use the menu to report the crash details.'
      )}
    >
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <AppRail />
        {layout.showSidebar ? (
          layout.leftTitlebarChromeLayout.shouldMount ? (
            /* Why: when the sidebar is collapsed, take this titlebar-height header out of flex layout so the terminal/editor reclaim the left edge. */
            <div
              className={`flex min-h-0 flex-col shrink-0${layout.sidebarOpen ? '' : ' relative w-0 overflow-visible'}`}
            >
              <div
                // Why: floating titlebar-left occludes the center column's border-l seam; border-r restores that line, w-max sizes it to its own controls.
                className={`titlebar-left${
                  layout.leftTitlebarChromeLayout.isFloating
                    ? ' titlebar-left-floating absolute top-0 left-0 z-10 w-max border-r border-border'
                    : ''
                }`}
                style={{
                  // Why: custom sidebar appearances are scoped to the sidebar root; mirror those vars onto the header in the same left-column panel.
                  ...(layout.sidebarOpen ? layout.leftSidebarStyle : undefined),
                  // Why: size from the wrapper's live width so the header tracks in-flight drag resizes (persisted to Zustand only on mouseup).
                  width: layout.sidebarOpen ? '100%' : undefined
                }}
              >
                {titlebarLeftControls}
              </div>
              {/* Why: flex-1/min-h-0 slot needed under the fixed 44px header, else the sidebar collapses to content height and loses its scroll viewport. */}
              <div className="flex min-h-0 flex-1">
                <WorktreeSidebar layout={layout} scrollRefs={sidebarScrollRefs} />
              </div>
            </div>
          ) : (
            <WorktreeSidebar layout={layout} scrollRefs={sidebarScrollRefs} />
          )
        ) : null}
        {/* Why: the status bar runs from the end of the left sidebar to the window's right edge, under the right sidebar too. */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
              {/* Why: a band only in the center column - the rail and sidebar reach the window top. Every section wears the same band. */}
              {!layout.leftTitlebarChromeLayout.shouldMount ? (
                <PageTopBand layout={layout} withLeftControls />
              ) : layout.stackedSidebarOpen ? (
                <PageTopBand layout={layout} withLeftControls={false} />
              ) : null}
              {layout.workspaceChromeActive && layout.activeWorktreeId && !topBarsActive ? (
                <SessionBar
                  worktreeId={layout.activeWorktreeId}
                  collapsePane={collapsePane}
                  // Why: the collapsed sidebar's floating header sits over the bar's left end.
                  reserveCollapsedSidebarHeader={
                    layout.leftTitlebarChromeLayout.isFloating && !layout.sidebarOpen
                  }
                  // Why: the bar sits at the window top, so its right end is under the window-controls overlay unless the right sidebar covers that corner.
                  reserveWindowControls={hasCustomTitleBar && !layout.rightSidebarOpen}
                />
              ) : null}
              <SplitTopBarChromeProvider value={splitTopBarChrome}>
                <div className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden">
                  <div className="flex flex-1 min-w-0 min-h-0 flex-col">
                    {layout.shouldMountTerminalWorkbench ? (
                      <TerminalWorkbenchContainer isVisible={layout.terminalWorkbenchVisible}>
                        <Suspense fallback={null}>
                          <RecoverableRenderErrorBoundary
                            boundaryId="terminal.workbench"
                            surface="terminal-workbench"
                            resetKey="terminal"
                            title={translate(
                              'auto.App.5a9519aef0',
                              'The workspace workbench hit an error.'
                            )}
                            description={translate(
                              'auto.App.98d4ea2823',
                              'Terminal, browser, or editor rendering failed in this workspace. Retry to remount it.'
                            )}
                          >
                            <Terminal />
                          </RecoverableRenderErrorBoundary>
                        </Suspense>
                      </TerminalWorkbenchContainer>
                    ) : null}
                    <Suspense fallback={null}>
                      <RecoverableRenderErrorBoundary
                        boundaryId={`page.${layout.activeView}`}
                        surface="page"
                        resetKey={layout.activeView}
                        title={translate('auto.App.b7a714db1e', 'This page hit an error.')}
                        description={translate(
                          'auto.App.03a14f6b5b',
                          'Retry the page or navigate to another MassOrca surface.'
                        )}
                      >
                        <ActivePage layout={layout} />
                      </RecoverableRenderErrorBoundary>
                    </Suspense>
                  </div>
                  {floatingWorkspace.showToggleButton ? (
                    <FloatingTerminalToggleButton
                      open={floatingWorkspace.open}
                      onToggle={() => floatingWorkspace.setOpenWithFocus((open) => !open)}
                    />
                  ) : null}
                </div>
              </SplitTopBarChromeProvider>
            </div>
            {/* Why: keep the shell mounted for layout stability (heavy panels disconnect while closed); unmount on the distraction-free tasks view. */}
            {layout.showRightSidebarControls ? (
              <RecoverableRenderErrorBoundary
                boundaryId="right-sidebar"
                surface="right-sidebar"
                resetKey={
                  layout.rightSidebarTab === 'explorer'
                    ? `${layout.rightSidebarTab}:${layout.rightSidebarExplorerView}`
                    : layout.rightSidebarTab
                }
                title={translate('auto.App.ed6b168d00', 'The right sidebar hit an error.')}
                description={translate(
                  'auto.App.8d1e160ed1',
                  'Retry the sidebar or switch tabs to reload this surface.'
                )}
              >
                <RightSidebar hideCloseButton />
              </RecoverableRenderErrorBoundary>
            ) : null}
          </div>
          <AppStatusBarSlot floatingTerminalOpen={floatingWorkspace.open} />
        </div>
      </div>
    </RecoverableRenderErrorBoundary>
  )
}
