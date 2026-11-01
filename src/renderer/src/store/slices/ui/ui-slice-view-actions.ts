import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import { rewindHistoryIndexPastView } from '../worktree-nav-history'

export function createUiViewActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    openActivityPage: () => {
      set((state) => ({
        activeView: 'activity',
        previousViewBeforeActivity:
          state.activeView === 'activity' ? state.previousViewBeforeActivity : state.activeView
      }))
    },
    closeActivityPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeActivity
      })),
    selectedAutomationId: null,
    setSelectedAutomationId: (id) => set({ selectedAutomationId: id }),
    pendingAutomationRunNavigation: null,
    setPendingAutomationRunNavigation: (navigation) =>
      set({ pendingAutomationRunNavigation: navigation }),
    openAutomationsPage: () => {
      get().recordViewVisit('automations')
      set((state) => ({
        activeView: 'automations',
        previousViewBeforeAutomations:
          state.activeView === 'automations'
            ? state.previousViewBeforeAutomations
            : state.activeView
      }))
    },
    closeAutomationsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeAutomations,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'automations')
      })),
    openSpacePage: () => {
      get().recordFeatureInteraction?.('workspace-cleanup')
      set((state) => ({
        activeView: 'space',
        previousViewBeforeSpace:
          state.activeView === 'space' ? state.previousViewBeforeSpace : state.activeView
      }))
    },
    closeSpacePage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeSpace
      })),
    openSkillsPage: () => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView
      }))
    },
    closeSkillsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeSkills,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'skills')
      })),
    openSkillShare: (shareId) => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView,
        pendingSkillShareId: shareId
      }))
    },
    clearPendingSkillShare: () => set({ pendingSkillShareId: null }),
    openSkillsSharedLinks: () => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView,
        pendingSkillsSharedView: true
      }))
    },
    clearPendingSkillsSharedView: () => set({ pendingSkillsSharedView: false }),
    openArtifactsPage: () => {
      get().recordViewVisit('artifacts')
      set((state) => ({
        activeView: 'artifacts',
        previousViewBeforeArtifacts:
          state.activeView === 'artifacts' ? state.previousViewBeforeArtifacts : state.activeView
      }))
    },
    closeArtifactsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeArtifacts,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'artifacts')
      })),
    openPrototypesPage: () => {
      get().recordViewVisit('prototypes')
      set((state) => ({
        activeView: 'prototypes',
        previousViewBeforePrototypes:
          state.activeView === 'prototypes' ? state.previousViewBeforePrototypes : state.activeView
      }))
    },
    closePrototypesPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforePrototypes,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'prototypes')
      })),
    // Why: not recorded in worktree nav history; back/forward would reopen a blank draft.
    openCreateChatPage: () =>
      set((state) => ({
        activeView: 'create-chat',
        createChatResetNonce: state.createChatResetNonce + 1
      })),
    railMode: 'workspaces',
    railWorkspacesHintShown: false,
    markRailWorkspacesHintShown: () => set({ railWorkspacesHintShown: true }),
    pressRailModeButton: () => {
      const state = get()
      const atHome =
        state.activeView === 'terminal' ||
        state.activeView === 'create-chat' ||
        state.activeView === 'bot-teams'
      const mode = atHome
        ? state.railMode === 'bot-teams'
          ? 'workspaces'
          : 'bot-teams'
        : state.railMode
      set({ railMode: mode })
      state.setActiveView(mode === 'bot-teams' ? 'bot-teams' : 'terminal')
      return atHome ? 'switched' : 'returned'
    },
    // Why: the rail's Tasks button lands on the clean home; every other entry point still opens the board through openTaskPage.
    openTasksHome: () => {
      get().recordViewVisit('tasks')
      set((state) => ({
        activeView: 'tasks',
        previousViewBeforeTasks:
          state.activeView === 'tasks' ? state.previousViewBeforeTasks : state.activeView,
        tasksHomeOpen: true
      }))
    },
    openMobilePage: () =>
      set((state) => ({
        activeView: 'mobile',
        previousViewBeforeMobile:
          state.activeView === 'mobile' ? state.previousViewBeforeMobile : state.activeView
      })),
    closeMobilePage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeMobile
      })),
    setNewWorkspaceDraft: (draft) => set({ newWorkspaceDraft: draft }),
    clearNewWorkspaceDraft: () => set({ newWorkspaceDraft: null })
  }
}
