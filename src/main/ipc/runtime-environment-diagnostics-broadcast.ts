import type { RemoteRuntimeSharedConnectionDiagnostics } from '../../shared/remote-runtime-shared-control-types'
import { RUNTIME_ENVIRONMENT_DIAGNOSTICS_CHANNEL } from '../../shared/runtime-environment-diagnostics'

export { RUNTIME_ENVIRONMENT_DIAGNOSTICS_CHANNEL }

export type RuntimeEnvironmentDiagnosticsEvent = {
  environmentId: string
  transportGeneration: number
  diagnostics: RemoteRuntimeSharedConnectionDiagnostics
}

export type RuntimeEnvironmentDiagnosticsSender = (
  event: RuntimeEnvironmentDiagnosticsEvent
) => void

// Why: the window shape is structural, so this module never imports electron.
export type RendererWindowLike = {
  isDestroyed(): boolean
  webContents: { send(channel: string, payload: unknown): void }
}

// Why: a headless host has no renderers, so nothing is published until the desktop installs a sender.
let sender: RuntimeEnvironmentDiagnosticsSender = () => undefined

// Why: the desktop installs its renderer sender once, at IPC registration.
export function setRuntimeEnvironmentDiagnosticsSender(
  next: RuntimeEnvironmentDiagnosticsSender
): void {
  sender = next
}

export function publishRuntimeEnvironmentDiagnostics(
  event: RuntimeEnvironmentDiagnosticsEvent
): void {
  sender(event)
}

export function createRendererDiagnosticsSender(
  getWindows: () => readonly RendererWindowLike[]
): RuntimeEnvironmentDiagnosticsSender {
  return (event) => {
    for (const window of getWindows()) {
      if (window.isDestroyed()) {
        continue
      }
      try {
        window.webContents.send(RUNTIME_ENVIRONMENT_DIAGNOSTICS_CHANNEL, event)
      } catch {
        // A renderer can disappear between isDestroyed() and send().
      }
    }
  }
}
