import type { SshChannelMultiplexer } from '../ssh/ssh-channel-multiplexer'

/** Agent launches a WSL relay materializes status for; Gentle Shell keeps its own guest home. */
export type WslHookLaunchKind = 'pi' | 'omp' | 'gentle-shell'

export type WslRelayDistroState = {
  distro: string
  phase: 'starting' | 'running' | 'failed'
  child?: { kill: () => void }
  mux?: SshChannelMultiplexer
  guestHome?: string
  codexHomePath?: string
  guestEndpointFilePath?: string
  opencodeOverlayDir?: string
  opencode2OverlayDir?: string
  piAgentDir?: string
  gentleShellAgentDir?: string
  ompStatusExtension?: string
  launchKinds: Set<WslHookLaunchKind>
  startup?: Promise<void>
  installation?: Promise<void>
  failures: number
  cooldownUntil: number
  connectedAt?: number
  restartTimer?: ReturnType<typeof setTimeout>
  reinstallTimer?: ReturnType<typeof setTimeout>
  lastInstallAt?: number
  lastOpenCodeSettings?: string
  lastAttemptOpenCodeSettings?: string
  lastInstallMux?: SshChannelMultiplexer
}
