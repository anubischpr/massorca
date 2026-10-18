import {
  detectExplicitPiAgentKindFromCommand,
  isPiCompatibleAgentType,
  type PiAgentKind
} from '../../shared/pi-agent-kind'
import { selectedPiRuntime } from '../../shared/pi-runtime-selection'
import type { TuiAgent } from '../../shared/tui-agent'
import { wslHookRelayManager, type WslHookRelayManager } from './wsl-hook-relay-manager'
import type { WslHookLaunchKind } from './wsl-hook-relay-state'

export async function awaitExplicitPiOmpGuestReadiness(args: {
  isWsl: boolean
  distro: string | null | undefined
  codexHomePath?: string | null
  launchAgent?: TuiAgent
  launchCommand?: string
  timeoutMs?: number
  manager?: Pick<
    WslHookRelayManager,
    'ensureForDistro' | 'getGuestEndpointFilePath' | 'getGuestAgentPath'
  >
}): Promise<boolean> {
  if (!args.isWsl) {
    return true
  }
  const kind: PiAgentKind | null = isPiCompatibleAgentType(args.launchAgent)
    ? args.launchAgent
    : detectExplicitPiAgentKindFromCommand(args.launchCommand)
  if (kind !== 'pi' && kind !== 'omp') {
    return true
  }
  // Why: a Gentle Shell launch waits on its own guest home, not the stock Pi one.
  const wslKind: WslHookLaunchKind = kind === 'pi' ? selectedPiRuntime(args.launchCommand) : kind
  const distro = args.distro ?? null
  const manager = args.manager ?? wslHookRelayManager
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      manager
        .ensureForDistro(distro, args.codexHomePath, wslKind)
        .then(() =>
          Boolean(
            manager.getGuestEndpointFilePath(distro) && manager.getGuestAgentPath(distro, wslKind)
          )
        ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), args.timeoutMs ?? 10_000)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
