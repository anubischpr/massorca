import type { MarketplaceHostProgramId } from '../../../shared/rpc-contract/marketplace-host-program-params'

export type HostPlatform = 'win32' | 'darwin' | 'linux'

export type RunResult = {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  /** The program could not be started on that host. */
  missing?: boolean
}

export type WhichResult =
  | { state: 'found'; path: string }
  | { state: 'absent' }
  | { state: 'unverifiable' }

/** The one door to a host: every command runs as argv on that host, never through a local shell. */
export type HostExecutor = {
  platform: HostPlatform
  which: (command: string) => Promise<WhichResult>
  run: (argv: readonly string[], timeoutMs: number) => Promise<RunResult>
  /** A constant script: `sh -c` on POSIX hosts, PowerShell text on Windows. Never built from input. */
  script: (script: string, timeoutMs: number) => Promise<RunResult>
}

/** Thrown by a transport when the host cannot be reached or is not a host these programs support. */
export class HostProgramHostError extends Error {
  constructor(
    readonly reason: 'unreachable' | 'unsupported',
    message: string
  ) {
    super(message)
  }
}

export type PackageMethod = 'winget' | 'brew' | 'npm' | 'apt' | 'dnf'

/** One vendor-supported way to install a program. `installable: false` is detect-and-remove only. */
export type InstallOption =
  | { method: 'winget'; id: string; installable?: boolean }
  | { method: 'brew'; name: string; cask?: boolean; installable?: boolean }
  | { method: 'npm'; pkg: string; installable?: boolean }
  | { method: 'apt' | 'dnf'; pkgs: readonly string[]; installable?: boolean }
  | {
      method: 'script'
      text: string
      display: string
      shell: 'sh' | 'powershell'
      installable?: boolean
    }

export type ProgramSpec = {
  id: MarketplaceHostProgramId
  label: string
  /** The command that proves the program is on the host's PATH. */
  command: string
  options: Record<HostPlatform, readonly InstallOption[]>
  /** A path under which the vendor's own installer puts the program. */
  nativePath?: RegExp
  /** Removal of that native install, only where the vendor documents one. */
  nativeUninstall?: Record<HostPlatform, { script: string; display: string } | null>
  /** Version managers own the binary; MassOrca will not uninstall through them. */
  versionManaged?: boolean
  /** What the vendor's own uninstaller would also delete, so the confirm step can say so. */
  vendorUninstallRemovesData?: string
  /** Where the program's data lives and stays after Uninstall. */
  keepsData?: string
}

/** A command MassOrca can run, plus the line shown to the person. */
export type PlanStep = {
  argv?: readonly string[]
  script?: string
  timeoutMs: number
  /** A step that only proves this host lets MassOrca use sudo without a password. */
  adminCheck?: boolean
}

export type ProgramPlan = {
  method: InstallOption['method']
  steps: readonly PlanStep[]
  /** The command to run by hand, with `sudo` when this host needs it. */
  display: string
  needsSudo: boolean
  /** What the person is told was removed, when a removal ran. */
  removedNote?: string
}
