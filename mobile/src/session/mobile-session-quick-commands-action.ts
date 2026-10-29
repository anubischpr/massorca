export type MobileSessionQuickCommandsActions = {
  open: () => void
  toast: (message: string, durationMs: number) => void
}

/** Opens quick commands once the desktop supports them; otherwise says why they are not there yet. */
export function resolveMobileSessionQuickCommandsAction(
  supported: boolean | null,
  actions: MobileSessionQuickCommandsActions
): void {
  if (supported === true) {
    actions.open()
    return
  }
  actions.toast(
    supported === false
      ? 'Desktop update required for quick commands'
      : 'Checking desktop capabilities — try again in a moment',
    1600
  )
}
