/** `pty:kill` reply. `exitConfirmed` is true only when the host proved the process is gone;
 *  the synthesized exit event a kill also publishes is never proof. */
export type PtyKillResult = { exitConfirmed: boolean }

export type PtyKillOptions = {
  keepHistory?: boolean
  /** Ask the host to check its own process inventory when no exit event was observed. */
  confirmExit?: boolean
}
