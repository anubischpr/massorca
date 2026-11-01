import {
  JevDecisionsSaveApiKey,
  JevDecisionsSetEnabled
} from '../../../../shared/rpc-contract/jev-decisions-params'
import { clearJevApiKey, readJevApiKeyStatus, saveJevApiKey } from '../../../jev/jev-api-key-store'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { defineMethod } from '../core'

function hostStatus(runtime: Pick<OrcaRuntimeService, 'isJevDecisionsEnabled'>) {
  return { ...readJevApiKeyStatus(), enabled: runtime.isJevDecisionsEnabled() }
}

// Why RPC: the decision runs on the host holding the chat, so a client connected to a server must
// configure that server, not its own machine. The key's value is never returned.
export const JEV_DECISIONS_METHODS = [
  defineMethod({
    name: 'jevDecisions.getStatus',
    permission: 'accounts-admin',
    params: null,
    handler: (_params, { runtime }) => hostStatus(runtime)
  }),
  defineMethod({
    name: 'jevDecisions.saveApiKey',
    permission: 'accounts-admin',
    params: JevDecisionsSaveApiKey,
    handler: (params, { runtime }) => {
      saveJevApiKey(params.apiKey)
      return hostStatus(runtime)
    }
  }),
  defineMethod({
    name: 'jevDecisions.clearApiKey',
    permission: 'accounts-admin',
    params: null,
    handler: (_params, { runtime }) => {
      clearJevApiKey()
      // Why: without a key the switch could not be turned on again, so it must not stay on.
      runtime.setJevDecisionsEnabled(false)
      return hostStatus(runtime)
    }
  }),
  defineMethod({
    name: 'jevDecisions.setEnabled',
    permission: 'settings-write',
    params: JevDecisionsSetEnabled,
    handler: (params, { runtime }) => {
      runtime.setJevDecisionsEnabled(params.enabled)
      return hostStatus(runtime)
    }
  })
]
