import { useMemo } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store'
import { sidePanelGroupId } from '../../store/slices/tabs/side-panel-group'
import { openMobileEmulatorTab } from '@/lib/open-mobile-emulator-tab'
import { getEditorDisplayLabel } from '../editor/editor-labels'
import { getBrowserTabLabel } from '../tab-bar/BrowserTab'
import { useTabGroupWorkspaceModel } from '../tab-group/useTabGroupWorkspaceModel'
import { buildSidePanelNewTabOptions, type SidePanelNewTabKind } from './side-panel-new-tab-options'
import type { Tab } from '../../../../shared/tab-types'

export type SidePanelTabKind = 'terminal' | 'browser' | 'editor' | 'simulator'

export type SidePanelTabItem = {
  id: string
  /** The id the rest of the app knows the tab by: its backing terminal or browser, else the tab. */
  visibleId: string
  kind: SidePanelTabKind
  label: string
  active: boolean
}

function kindOf(tab: Tab): SidePanelTabKind {
  if (tab.contentType === 'terminal' || tab.contentType === 'browser') {
    return tab.contentType
  }
  return tab.contentType === 'simulator' ? 'simulator' : 'editor'
}

/** The side panel's tabs and create/activate/close commands, on top of the shared group model. */
export function useSidePanelModel(worktreeId: string) {
  const groupId = sidePanelGroupId(worktreeId)
  const model = useTabGroupWorkspaceModel({ groupId, worktreeId })
  const mobileEmulatorEnabled = useAppStore((s) => s.settings?.mobileEmulatorEnabled !== false)
  const focusSidePanel = useAppStore((s) => s.focusSidePanel)
  const { groupTabs, group, activeTab, terminalTabs, editorItems, browserItems, commands } = model

  const items = useMemo<SidePanelTabItem[]>(() => {
    const byId = new Map(groupTabs.map((tab) => [tab.id, tab]))
    const ordered = (group?.tabOrder ?? []).flatMap((id) => {
      const tab = byId.get(id)
      return tab ? [tab] : []
    })
    return ordered.map((tab) => {
      let label = tab.label
      if (tab.contentType === 'terminal') {
        label = terminalTabs.find((t) => t.unifiedTabId === tab.id)?.title ?? tab.label
      } else if (tab.contentType === 'browser') {
        const browser = browserItems.find((b) => b.tabId === tab.id)
        label = browser ? getBrowserTabLabel(browser) : tab.label
      } else if (tab.contentType !== 'simulator') {
        const file = editorItems.find((f) => f.tabId === tab.id)
        label = file ? getEditorDisplayLabel(file) : tab.label
      }
      const visibleId =
        tab.contentType === 'terminal' || tab.contentType === 'browser' ? tab.entityId : tab.id
      return { id: tab.id, visibleId, kind: kindOf(tab), label, active: tab.id === activeTab?.id }
    })
  }, [activeTab?.id, browserItems, editorItems, group?.tabOrder, groupTabs, terminalTabs])

  const activate = (id: string): void => {
    const tab = groupTabs.find((candidate) => candidate.id === id)
    if (!tab) {
      return
    }
    if (tab.contentType === 'terminal') {
      commands.activateTerminal(tab.entityId)
    } else if (tab.contentType === 'browser') {
      commands.activateBrowser(tab.entityId)
    } else {
      commands.activateEditor(tab.id)
    }
  }

  const create = (kind: SidePanelNewTabKind): void => {
    // Why: creation needs the panel group to exist and hold focus before it targets it.
    focusSidePanel(worktreeId)
    if (kind === 'new-terminal') {
      commands.newTerminalTab()
    } else if (kind === 'new-browser') {
      commands.newBrowserTab()
    } else if (kind === 'new-markdown') {
      void commands.newFileTab()
    } else {
      void openMobileEmulatorTab(worktreeId, {
        placement: 'activeGroup',
        targetGroupId: groupId
      }).catch((error) => {
        toast.error(error instanceof Error ? error.message : String(error))
      })
    }
  }

  return {
    groupId,
    items,
    newTabOptions: buildSidePanelNewTabOptions(mobileEmulatorEnabled),
    activate,
    close: (id: string) => commands.closeItem(id),
    create
  }
}
