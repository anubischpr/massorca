// Pure master-detail panel-host logic for the mobile session screen. No React/native
// imports so the dock-vs-push decision and the active-panel state machine are
// unit-testable under node Vitest (KTD3/R8).

// 'terminal' takes the session body in place on every layout: its terminal views are the
// session screen's own state, so it can neither dock beside the session nor push a route.
export type ActivePanel = 'sourceControl' | 'files' | 'pr' | 'terminal' | null

// The panels that dock on wide layouts and push a full-screen route on narrow ones.
export type RoutedPanel = Exclude<ActivePanel, null | 'terminal'>

// Toggle/swap reducer for the wide-layout dock: tapping the active panel closes it,
// tapping any other opens/swaps to it. Exactly one panel docks at a time (R2).
export function nextActivePanel(
  current: ActivePanel,
  tapped: Exclude<ActivePanel, null>
): ActivePanel {
  return tapped === current ? null : tapped
}

export type PanelAction = { kind: 'dock'; next: ActivePanel } | { kind: 'push'; panel: RoutedPanel }

export const SESSION_DOCK_MIN_MAIN_WIDTH = 360

export function shouldShowSessionHeaderChecksAction(args: {
  isFolderWorkspaceRoute: boolean
  repoContextLoaded: boolean
  hostedChecksSupported: boolean
}): boolean {
  // Why: the hosted checks panel is provider-gated and the pr-panel guard
  // force-closes it for unsupported providers, so offering the action there
  // (or before the provider probe resolves) would be a silent no-op.
  return !args.isFolderWorkspaceRoute && args.repoContextLoaded && args.hostedChecksSupported
}

export function canDockSessionPanel(args: {
  isWideLayout: boolean
  availableWidth: number
  dockWidth: number
  minMainWidth?: number
}): boolean {
  return (
    args.isWideLayout &&
    args.availableWidth >= args.dockWidth + (args.minMainWidth ?? SESSION_DOCK_MIN_MAIN_WIDTH)
  )
}

// The panel the dock column draws, or null: the terminal is never docked.
export function dockedPanelOf(active: ActivePanel): RoutedPanel | null {
  return active === 'terminal' ? null : active
}

// Wide layouts dock (toggle/swap the sidebar beside the terminal); narrow layouts
// push the panel's full-screen route (R3/R7). The caller maps a push to the concrete
// expo-router path + params via panelRouteDescriptor.
export function resolvePanelAction(args: {
  canDock: boolean
  tapped: RoutedPanel
  current: ActivePanel
}): PanelAction {
  if (args.canDock) {
    return { kind: 'dock', next: nextActivePanel(args.current, args.tapped) }
  }
  return { kind: 'push', panel: args.tapped }
}

// Single source of truth for each panel's expo-router pathname pattern so narrow-push
// and any deep-linking agree; the caller supplies the [hostId]/[worktreeId] params.
// The Pull Request panel is a segment of the source-control hub, so its narrow-push
// targets that route with `tab: 'pr'` rather than the standalone (redirecting) route.
export function panelRouteDescriptor(panel: RoutedPanel): {
  pathname: string
  params?: Record<string, string>
} {
  switch (panel) {
    case 'sourceControl':
      return { pathname: '/h/[hostId]/source-control/[worktreeId]' }
    case 'files':
      return { pathname: '/h/[hostId]/files/[worktreeId]' }
    case 'pr':
      return { pathname: '/h/[hostId]/source-control/[worktreeId]', params: { tab: 'pr' } }
  }
}
