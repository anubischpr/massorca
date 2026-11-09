import {
  MARKETPLACE_PROGRAM_INSTALL_METHOD,
  MARKETPLACE_PROGRAM_REINSTALL_METHOD,
  MARKETPLACE_PROGRAM_STATUS_METHOD,
  MARKETPLACE_PROGRAM_UNINSTALL_METHOD,
  MarketplaceHostProgramParams,
  readMarketplaceHostProgramResult,
  readMarketplaceHostProgramStatus,
  type MarketplaceHostProgramResult,
  type MarketplaceHostProgramStatus
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import { reinstallHostProgram } from '../../../marketplace/host-programs/host-program-reinstall'
import { dispatchHostProgram } from '../../../marketplace/host-programs/host-program-router'
import {
  hostProgramStatus,
  installHostProgram,
  uninstallHostProgram
} from '../../../marketplace/host-programs/host-program-service'
import { defineMethod } from '../core'

// Why: install, uninstall and reinstall change a host, so they need host-admin; status only reads. Every paired client that holds accounts-admin holds host-admin too.
export const marketplaceProgramStatusMethod = defineMethod({
  name: MARKETPLACE_PROGRAM_STATUS_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceHostProgramParams,
  handler: (params): Promise<MarketplaceHostProgramStatus> =>
    dispatchHostProgram(
      MARKETPLACE_PROGRAM_STATUS_METHOD,
      params,
      (exec) => hostProgramStatus(params.program, exec),
      readMarketplaceHostProgramStatus
    )
})

export const marketplaceProgramInstallMethod = defineMethod({
  name: MARKETPLACE_PROGRAM_INSTALL_METHOD,
  permission: 'host-admin',
  params: MarketplaceHostProgramParams,
  handler: (params): Promise<MarketplaceHostProgramResult> =>
    dispatchHostProgram(
      MARKETPLACE_PROGRAM_INSTALL_METHOD,
      params,
      (exec) => installHostProgram(params.program, exec),
      readMarketplaceHostProgramResult
    )
})

export const marketplaceProgramReinstallMethod = defineMethod({
  name: MARKETPLACE_PROGRAM_REINSTALL_METHOD,
  permission: 'host-admin',
  params: MarketplaceHostProgramParams,
  handler: (params): Promise<MarketplaceHostProgramResult> =>
    dispatchHostProgram(
      MARKETPLACE_PROGRAM_REINSTALL_METHOD,
      params,
      (exec) => reinstallHostProgram(params.program, exec),
      readMarketplaceHostProgramResult
    )
})

export const marketplaceProgramUninstallMethod = defineMethod({
  name: MARKETPLACE_PROGRAM_UNINSTALL_METHOD,
  permission: 'host-admin',
  params: MarketplaceHostProgramParams,
  handler: async (params): Promise<MarketplaceHostProgramResult> => {
    // Why: the relay MassOrca runs on an SSH host is a Node.js program, so removing it would cut the host off.
    if (params.program === 'node' && params.host?.startsWith('ssh:')) {
      return {
        ok: false,
        reason: 'unsupported',
        message:
          'MassOrca runs its connection to this SSH host on Node.js, so it is not removed here.'
      }
    }
    return dispatchHostProgram(
      MARKETPLACE_PROGRAM_UNINSTALL_METHOD,
      params,
      (exec) => uninstallHostProgram(params.program, exec),
      readMarketplaceHostProgramResult
    )
  }
})

export const MARKETPLACE_HOST_PROGRAM_METHODS = [
  marketplaceProgramStatusMethod,
  marketplaceProgramInstallMethod,
  marketplaceProgramReinstallMethod,
  marketplaceProgramUninstallMethod
]
