import { CLIENT_PLATFORM } from '@/lib/new-workspace'
import { resolveWindowsShellOverride } from '@/lib/pane-manager/windows-pty-compatibility'
import { parseExecutionHostId } from '../../../shared/execution-host'
import { isWslUncPath } from '../../../shared/wsl-paths'
import { resolveLocalWindowsAgentStartupShell } from '../../../shared/windows-terminal-shell'
import type { ProjectExecutionRuntimeResolution } from '../../../shared/project-execution-runtime'
import type { AgentStartupShell } from '../../../shared/tui-agent-startup-shell'

export type AgentResumeLaunchTarget = {
  platform: NodeJS.Platform
  /** undefined keeps the platform default: PowerShell on win32, POSIX elsewhere. */
  shell: AgentStartupShell | undefined
}

export type AgentResumeLaunchTargetArgs = {
  projectRuntime: ProjectExecutionRuntimeResolution | undefined
  /** SSH connection owning the workspace, if any. */
  connectionId: string | null | undefined
  /** Pane/workspace execution owner; only a 'local' host is the one `terminalWindowsShell` describes. */
  executionHostId: string | null
  worktreePath: string | null | undefined
  terminalWindowsShell: string | null | undefined
  /** Per-tab Windows shell override, which beats the global setting at spawn time. */
  tabShellOverride?: string | null
  /** Last verified OS of a paired runtime host that owns the workspace; null when not known. */
  runtimeHostPlatform?: NodeJS.Platform | null
}

function resolveResumeLaunchPlatform(args: AgentResumeLaunchTargetArgs): NodeJS.Platform {
  if (args.projectRuntime?.status === 'repair-required') {
    return args.projectRuntime.repair.preferredRuntime.kind === 'wsl' ? 'linux' : CLIENT_PLATFORM
  }
  if (args.projectRuntime?.status === 'resolved' && args.projectRuntime.runtime.kind === 'wsl') {
    return 'linux'
  }
  if (args.connectionId || (args.worktreePath && isWslUncPath(args.worktreePath))) {
    return 'linux'
  }
  // Why: the resume line is typed into the paired host's shell, so its quoting follows that host's OS, not this client's.
  return args.runtimeHostPlatform ?? CLIENT_PLATFORM
}

/**
 * Platform *and* live shell family a queued agent-resume command must be quoted for.
 * Why the shell half matters: resume lines are typed into a real terminal, so on a
 * cmd.exe tab the win32 PowerShell default sends literal quotes and the agent CLI
 * rejects the resume argv ("unexpected argument ''<uuid>'' found", #12320).
 */
export function resolveAgentResumeLaunchTarget(
  args: AgentResumeLaunchTargetArgs
): AgentResumeLaunchTarget {
  const platform = resolveResumeLaunchPlatform(args)
  return {
    platform,
    shell: resolveLocalWindowsAgentStartupShell({
      platform,
      isRemote:
        Boolean(args.connectionId) || parseExecutionHostId(args.executionHostId)?.kind !== 'local',
      terminalWindowsShell: resolveWindowsShellOverride(
        args.tabShellOverride,
        args.terminalWindowsShell
      )
    })
  }
}
