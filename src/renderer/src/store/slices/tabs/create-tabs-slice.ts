import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { TabsSlice } from './tabs-slice-contract'
import { createTabsCreateActions } from './tabs-create-actions'
import { createTabsFocusActions } from './tabs-focus-actions'
import { createTabsCloseActions } from './tabs-close-actions'
import { createTabsBulkCloseActions } from './tabs-bulk-close-actions'
import { createTabsLabelActions } from './tabs-label-actions'
import { createTabsGroupActions } from './tabs-group-actions'
import { createTabsMoveActions } from './tabs-move-actions'
import { createTabsDropActions } from './tabs-drop-actions'
import { createTabsSecondaryActions } from './tabs-secondary-actions'
import { createTabsSessionActions } from './tabs-session-actions'
import { createSidePanelActions, DEFAULT_SIDE_PANEL_WIDTH } from './side-panel-state'

export const createTabsSlice: StateCreator<AppState, [], [], TabsSlice> = (set, get) => ({
  unifiedTabsByWorktree: {},
  groupsByWorktree: {},
  activeGroupIdByWorktree: {},
  layoutByWorktree: {},
  sidePanelOpenByWorktree: {},
  sidePanelWidth: DEFAULT_SIDE_PANEL_WIDTH,
  ...createSidePanelActions(set),
  ...createTabsCreateActions(set, get),
  ...createTabsFocusActions(set, get),
  ...createTabsCloseActions(set, get),
  ...createTabsBulkCloseActions(set, get),
  ...createTabsLabelActions(set, get),
  ...createTabsGroupActions(set, get),
  ...createTabsMoveActions(set, get),
  ...createTabsDropActions(set, get),
  ...createTabsSecondaryActions(set, get),
  ...createTabsSessionActions(set, get)
})
