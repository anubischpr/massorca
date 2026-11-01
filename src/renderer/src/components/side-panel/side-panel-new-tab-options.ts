import {
  buildTabCreateMenuOptions,
  type TabCreateMenuOptionKind
} from '../tab-bar/tab-create-menu-options'

export type SidePanelNewTabKind = Extract<
  TabCreateMenuOptionKind,
  'new-terminal' | 'new-browser' | 'new-markdown' | 'new-simulator'
>

export type SidePanelNewTabOption = { kind: SidePanelNewTabKind; label: string }

/** The four creatable kinds, labelled by the same strings the tab bar's create menu uses. */
export function buildSidePanelNewTabOptions(
  mobileEmulatorEnabled: boolean
): SidePanelNewTabOption[] {
  return buildTabCreateMenuOptions({
    hasNewBrowser: true,
    hasNewMarkdown: true,
    hasOpenMarkdown: false,
    hasSimulator: mobileEmulatorEnabled,
    simulatorIsGoTo: false,
    terminalOnly: false
  }).flatMap((option) =>
    option.kind === 'new-terminal' ||
    option.kind === 'new-browser' ||
    option.kind === 'new-markdown' ||
    option.kind === 'new-simulator'
      ? [{ kind: option.kind, label: option.label }]
      : []
  )
}
