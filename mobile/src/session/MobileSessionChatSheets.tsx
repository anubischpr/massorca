import { useMobilePrototypeMenuCount } from '../prototypes/use-mobile-prototype-menu-count'
import { resolveMobileSessionQuickCommandsAction } from './mobile-session-quick-commands-action'
import { MobileSessionHeaderMoreActionsSheet } from './MobileSessionHeaderMoreActionsSheet'
import { MobilePlanSheet } from './MobilePlanSheet'
import { MobileSessionsSheet } from './MobileSessionsSheet'
import type { MobileSessionController } from './use-mobile-session-controller'

/** The sheets the native chat opens from its header: the session switcher, the plan, and the ⋯ menu. */
export function MobileSessionChatSheets({ controller }: { controller: MobileSessionController }) {
  // The guard the header's + and quick-commands buttons held: no new tab while one is being created, or offline.
  const creationBlocked =
    controller.creating ||
    controller.creatingBrowser ||
    controller.creatingMarkdown ||
    controller.connState !== 'connected'
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
    planSteps,
    planProgress,
    openPlanSheet,
    planSheetOpen,
    setPlanSheetOpen,
    headerMenu,
    recordedFileCount,
    openSummary,
    openArtifacts,
    openPrototypes,
    openBranch,
    openSessionTabActionSheetAfterKeyboardDismiss,
    quickCommandsSupported,
    setShowQuickCommands,
    showToast
  } = controller
  const prototypeCount = useMobilePrototypeMenuCount({
    client: controller.client,
    sessionId: controller.nativeChatController.nativeChatPrototypeSend?.sessionId ?? null,
    visible: showHeaderMoreActions
  })
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
        onTabActions={openSessionTabActionSheetAfterKeyboardDismiss}
        newTabDisabled={creationBlocked}
      />
      <MobilePlanSheet
        visible={planSheetOpen}
        plan={planSteps}
        onClose={() => setPlanSheetOpen(false)}
      />
      <MobileSessionHeaderMoreActionsSheet
        visible={showHeaderMoreActions}
        menu={headerMenu}
        planHint={planProgress ? `${planProgress.done} of ${planProgress.total} done` : undefined}
        recordedFileCount={recordedFileCount}
        prototypesBadge={prototypeCount > 0 ? String(prototypeCount) : undefined}
        onOpenPrototypes={openPrototypes}
        onOpenPlan={openPlanSheet}
        onOpenSummary={openSummary}
        onOpenArtifacts={openArtifacts}
        quickCommandsDisabled={creationBlocked}
        onOpenQuickCommands={() =>
          resolveMobileSessionQuickCommandsAction(quickCommandsSupported, {
            open: () => setShowQuickCommands(true),
            toast: showToast
          })
        }
        onOpenAgentHistory={openAgentSessionHistory}
        onOpenBranch={openBranch}
        onOpenChecks={() => handlePanelTap('pr')}
        onClose={() => setShowHeaderMoreActions(false)}
      />
    </>
  )
}
