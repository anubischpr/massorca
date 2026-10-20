import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { AgentStartupPlan } from '@/lib/tui-agent-startup'
import type {
  LaunchAgentInNewTabArgs,
  LaunchAgentInNewTabResult
} from '@/lib/launch-agent-in-new-tab'
import {
  resolveStructuredAgentSessionOwner,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import type { WorktreeRuntimeOwnerState } from '@/lib/worktree-runtime-owner'
import {
  askHostCreateSupport,
  LOCAL_ADMISSION_WAIT_MS,
  type HostCreateSupport
} from '@/lib/structured-agent-session-host-admission'
import type { TuiAgent } from '../../../shared/tui-agent'
import {
  hasExplicitPiCommand,
  isPiRuntimeSelection,
  piTerminalCommandOverrides,
  resolvePiRuntime,
  type HostPiTerminalRuntime,
  type PiRuntimeSelection
} from '../../../shared/pi-runtime-selection'

/** A new-tab launch's arguments, plus the host's answer for which Pi a terminal launch runs. */
export type PiTerminalLaunchArgs = LaunchAgentInNewTabArgs & {
  hostPiRuntime?: HostPiTerminalRuntime
}

/** The Pi command settings a terminal launch uses, given the host's answer when it has one. */
export function hostPiCommandOverrides<T extends Partial<Record<string, string>>>(
  cmdOverrides: T,
  args: Pick<PiTerminalLaunchArgs, 'hostPiRuntime'>
): T {
  return piTerminalCommandOverrides(cmdOverrides, args.hostPiRuntime ?? 'unknown')
}

/** The host to ask which Pi a terminal launch runs: only for a Pi launch with no client Pi command,
 *  on a workspace whose execution host a runtime serves. Null keeps the launch synchronous. */
function piTerminalHostTargetToAsk(
  state: WorktreeRuntimeOwnerState,
  request: {
    worktreeId: string
    agent: TuiAgent
    cmdOverrides: Partial<Record<string, string>>
    hostPiRuntime?: HostPiTerminalRuntime
  }
): RuntimeClientTarget | null {
  if (
    request.agent !== 'pi' ||
    request.hostPiRuntime !== undefined ||
    hasExplicitPiCommand(request.cmdOverrides)
  ) {
    return null
  }
  // An SSH host has no runtime to ask, so its terminal keeps the stock command.
  const executionHostId = resolveStructuredAgentSessionOwner(state, request.worktreeId)
  return executionHostId ? structuredAgentSessionTargetForHost(executionHostId) : null
}

/** The Pi runtime a host's create-support answer says it runs. Only an answer that names a cause or
 *  a runtime is a verdict; anything else is `unknown`. */
export function hostPiTerminalRuntimeFromCreateSupport(
  support: HostCreateSupport
): HostPiTerminalRuntime {
  if (support.kind === 'admitted') {
    const runtime = support.seedOptions?.piRuntime
    return isPiRuntimeSelection(runtime) ? runtime : 'pi'
  }
  if (support.kind === 'policy-unsupported') {
    // Restricted access is refused only for stock Pi, so the host runs it.
    return 'pi'
  }
  if (support.kind === 'declined' && support.cause === 'cliMissing') {
    return 'cliMissing'
  }
  return 'unknown'
}

/** Asks the host that runs this workspace's terminal which Pi it has. A local host that does not
 *  answer in time, or a paired host that cannot be reached, reads as `unknown`. */
export async function askHostPiTerminalRuntime(
  target: RuntimeClientTarget,
  worktreeId: string
): Promise<HostPiTerminalRuntime> {
  const asked = askHostCreateSupport(target, worktreeId, 'pi').then(
    hostPiTerminalRuntimeFromCreateSupport
  )
  if (target.kind !== 'local') {
    return asked
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<HostPiTerminalRuntime>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), LOCAL_ADMISSION_WAIT_MS)
  })
  try {
    return await Promise.race([asked, timedOut])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The Pi runtime an existing chat's terminal runs: what its session names, else what the workspace's
 * host runs, else the client's Pi command. The terminal view resolves here, so a chat whose session
 * names nothing yet still never starts stock `pi` on a host that only has Gentle Shell.
 */
export async function resolvePiRuntimeForLaunch(args: {
  worktreeId: string
  /** A runtime the session already named; it is final. */
  sessionRuntime?: PiRuntimeSelection
}): Promise<PiRuntimeSelection> {
  if (args.sessionRuntime) {
    return args.sessionRuntime
  }
  const state = useAppStore.getState()
  const command = state.settings?.agentCmdOverrides?.pi
  const hostTarget = piTerminalHostTargetToAsk(state, {
    worktreeId: args.worktreeId,
    agent: 'pi',
    cmdOverrides: { pi: command ?? '' }
  })
  const hostAnswer = hostTarget
    ? await askHostPiTerminalRuntime(hostTarget, args.worktreeId)
    : undefined
  return resolvePiRuntime({ hostAnswer, command })
}

/** Tells the user that no Pi runs on the host, the same cause a declined chat names. */
function notifyHostPiMissing(): void {
  toast.error(
    translate(
      'components.native-chat.structuredSessionHostDeclinedPiMissing',
      'Neither Pi nor Gentle Shell is installed on this server.'
    )
  )
}

/**
 * A Pi terminal launch with no client command waits for the host that runs its terminal to say which
 * Pi it has, then relaunches with that answer: Gentle Shell on a host with no stock `pi`. Undefined
 * when there is nothing to wait for, so the launch proceeds synchronously.
 */
export function deferPiTerminalForHostAnswer(
  args: PiTerminalLaunchArgs,
  startupPlan: AgentStartupPlan,
  relaunch: (args: PiTerminalLaunchArgs) => LaunchAgentInNewTabResult
): LaunchAgentInNewTabResult | undefined {
  const state = useAppStore.getState()
  const hostTarget = piTerminalHostTargetToAsk(state, {
    ...args,
    cmdOverrides: state.settings?.agentCmdOverrides ?? {}
  })
  if (!hostTarget) {
    return undefined
  }
  if (args.beforeSurfaceOpen?.({ kind: 'host-published' }) === false) {
    return null
  }
  const deliversPrompt =
    Boolean(args.prompt?.trim()) && (args.promptDelivery ?? 'auto-submit') !== 'draft'
  // Why: the relaunch keeps the request or plan decided before the wait, so the answer cannot reroute it.
  const opened = askHostPiTerminalRuntime(hostTarget, args.worktreeId).then((hostPiRuntime) => {
    if (hostPiRuntime === 'cliMissing') {
      notifyHostPiMissing()
      return null
    }
    return relaunch({ ...args, beforeSurfaceOpen: undefined, hostPiRuntime })
  })
  void opened.catch((error: unknown) =>
    console.error('Pi terminal launch failed after the host answered', error)
  )
  return {
    surface: { kind: 'host-published' },
    startupPlan,
    pasteDraftAfterLaunch: false,
    ...(deliversPrompt
      ? {
          promptDeliveryResult: opened.then(
            (result) =>
              result
                ? (result.promptDeliveryResult ?? { delivered: true, failureNotified: false })
                : { delivered: false, failureNotified: false },
            () => ({ delivered: false, failureNotified: false })
          )
        }
      : {})
  }
}
