import { useMobilePrototypeMenuCount } from '../prototypes/use-mobile-prototype-menu-count'
import { resolveMobileSessionQuickCommandsAction } from './mobile-session-quick-commands-action'
import { MobileSessionHeaderMoreActionsSheet } from './MobileSessionHeaderMoreActionsSheet'
import { MobileNativeChatChecklistSheets } from './MobileNativeChatChecklistSheets'
import { MobilePlanSheet } from './MobilePlanSheet'
import { MobileSessionsSheet } from './MobileSessionsSheet'
import type { MobileSessionController } from './use-mobile-session-controller'
import { formatAgentTypeLabel } from '../../../src/shared/agent-type-label'

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
    chatChecklist,
    checklistHint,
    openChecklist,
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
        childParentTabIds={controller.childParentTabIds}
      />
      <MobilePlanSheet
        visible={planSheetOpen}
        plan={planSteps}
        onClose={() => setPlanSheetOpen(false)}
      />
      <MobileNativeChatChecklistSheets
        view={chatChecklist}
        agentLabel={formatAgentTypeLabel(controller.nativeChatController.nativeChatAgent)}
        onSendNow={() => {
          void controller.nativeChatController.handleNativeChatSend('Checklist updated.')
        }}
      />
      <MobileSessionHeaderMoreActionsSheet
        visible={showHeaderMoreActions}
        menu={headerMenu}
        planHint={planProgress ? `${planProgress.done} of ${planProgress.total} done` : undefined}
        checklistHint={checklistHint}
        recordedFileCount={recordedFileCount}
        prototypesBadge={prototypeCount > 0 ? String(prototypeCount) : undefined}
        onOpenPrototypes={openPrototypes}
        onOpenPlan={openPlanSheet}
        onOpenChecklist={openChecklist}
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
