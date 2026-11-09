import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import {
  MARKETPLACE_PROGRAM_INSTALL_METHOD,
  MARKETPLACE_PROGRAM_REINSTALL_METHOD,
  MARKETPLACE_PROGRAM_STATUS_METHOD,
  MARKETPLACE_PROGRAM_UNINSTALL_METHOD,
  readMarketplaceHostProgramResult,
  readMarketplaceHostProgramStatus,
  type MarketplaceHostProgramId,
  type MarketplaceHostProgramResult,
  type MarketplaceHostProgramStatus
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import type { TuiAgent } from '../../../../shared/tui-agent'

export type HostProgramAction = 'install' | 'uninstall' | 'reinstall'

const ACTION_METHOD: Record<HostProgramAction, string> = {
  install: MARKETPLACE_PROGRAM_INSTALL_METHOD,
  reinstall: MARKETPLACE_PROGRAM_REINSTALL_METHOD,
  uninstall: MARKETPLACE_PROGRAM_UNINSTALL_METHOD
}

/** The program an agent page installs; agents MassOrca has no vendor install for return null. */
export function agentHostProgram(agent: TuiAgent): MarketplaceHostProgramId | null {
  switch (agent) {
    case 'claude':
    case 'codex':
    case 'antigravity':
      return agent
    case 'pi':
      return 'gentle-shell'
    default:
      return null
  }
}

function failureOf(error: unknown): { ok: false; reason: 'host-needs-update' | 'failed' } {
  // Why: the desktop answers method_not_found when it predates the methods; the person is told to update it.
  return hasRuntimeRpcErrorCode(error, 'method_not_found') ||
    hasRuntimeRpcErrorCode(error, 'forbidden')
    ? { ok: false, reason: 'host-needs-update' }
    : { ok: false, reason: 'failed' }
}

// Why the local desktop: it drives WSL, SSH and paired hosts itself, so every host key goes to one door.
export async function readHostProgramStatus(
  program: MarketplaceHostProgramId,
  hostKey: string
): Promise<MarketplaceHostProgramStatus> {
  try {
    return readMarketplaceHostProgramStatus(
      await callRuntimeRpc<unknown>({ kind: 'local' }, MARKETPLACE_PROGRAM_STATUS_METHOD, {
        program,
        host: hostKey
      })
    )
  } catch (error) {
    return failureOf(error)
  }
}

export async function runHostProgramAction(
  action: HostProgramAction,
  program: MarketplaceHostProgramId,
  hostKey: string
): Promise<MarketplaceHostProgramResult> {
  try {
    return readMarketplaceHostProgramResult(
      await callRuntimeRpc<unknown>({ kind: 'local' }, ACTION_METHOD[action], {
        program,
        host: hostKey
      })
    )
  } catch (error) {
    return failureOf(error)
  }
}
