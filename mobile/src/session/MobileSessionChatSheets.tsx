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
    showChecksAction,
    switchSessionTab,
    setShowCreateTabDrawer,
    sessionRows,
    sessionsSheetOpen,
    setSessionsSheetOpen,
    planSteps,
    planProgress,
    openPlanSheet,
    planSheetOpen,
    setPlanSheetOpen
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
        showPlan={planSteps !== null}
        planHint={planProgress ? `${planProgress.done} of ${planProgress.total} done` : undefined}
        showAgentSessionHistory={showAgentSessionHistoryAction}
        showChecks={showChecksAction}
        onOpenPlan={openPlanSheet}
        onOpenAgentSessionHistory={openAgentSessionHistory}
        onOpenChecks={() => handlePanelTap('pr')}
        onClose={() => setShowHeaderMoreActions(false)}
      />
    </>
  )
}
