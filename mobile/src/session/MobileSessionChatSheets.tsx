import { MobileSessionHeaderMoreActionsSheet } from './MobileSessionHeaderMoreActionsSheet'
import { MobilePlanSheet } from './MobilePlanSheet'
import { MobileSessionsSheet } from './MobileSessionsSheet'
import type { MobileSessionController } from './use-mobile-session-controller'

/** The sheets the native chat opens from its header: the session switcher, the plan, and the ⋯ menu. */
export function MobileSessionChatSheets({ controller }: { controller: MobileSessionController }) {
  const {
    showHeaderMoreActions,
    setShowHeaderMoreActions,
    handlePanelTap,
    openAgentSessionHistory,
    showAgentSessionHistoryAction,
    switchSessionTab,
    setShowCreateTabDrawer,
    sessionRows,
    sessionsSheetOpen,
    setSessionsSheetOpen,
    openSessionsSheet,
    planSteps,
    planProgress,
    openPlanSheet,
    planSheetOpen,
    setPlanSheetOpen,
    headerMenu,
    recordedFileCount,
    openSummary,
    openArtifacts,
    openBranch
  } = controller
  return (
    <>
      <MobileSessionsSheet
        visible={sessionsSheetOpen}
        rows={sessionRows}
        showResume={showAgentSessionHistoryAction}
        onClose={() => setSessionsSheetOpen(false)}
        onSelect={switchSessionTab}
        onNewTab={() => setShowCreateTabDrawer(true)}
        onResume={openAgentSessionHistory}
      />
      <MobilePlanSheet
        visible={planSheetOpen}
        plan={planSteps}
        onClose={() => setPlanSheetOpen(false)}
      />
      <MobileSessionHeaderMoreActionsSheet
        visible={showHeaderMoreActions}
        menu={headerMenu}
        tabCount={sessionRows.length}
        planHint={planProgress ? `${planProgress.done} of ${planProgress.total} done` : undefined}
        recordedFileCount={recordedFileCount}
        onOpenSessions={openSessionsSheet}
        onOpenPlan={openPlanSheet}
        onOpenSummary={openSummary}
        onOpenArtifacts={openArtifacts}
        onOpenAgentHistory={openAgentSessionHistory}
        onOpenBranch={openBranch}
        onOpenChecks={() => handlePanelTap('pr')}
        onClose={() => setShowHeaderMoreActions(false)}
      />
    </>
  )
}
