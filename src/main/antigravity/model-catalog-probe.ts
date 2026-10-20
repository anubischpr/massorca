import { homedir } from 'node:os'
import { groupAntigravityModelVariants } from '../../shared/antigravity-model-variants'
import { parseAntigravityModels } from '../../shared/commit-message-model-parsers'
import type { AgentModelCatalogProbe } from '../native-chat/agent-model-catalog/agent-model-catalog-store'
import { runAgentModelCatalogListing } from '../native-chat/agent-model-catalog/agent-model-catalog-probe-runner'
import type { AntigravityLaunchDeps } from './structured-launch-resolution'
import {
  antigravityCliVersionOutcome,
  resolveAntigravityCommand
} from './structured-launch-resolution'
import { readAntigravityAccountBinding } from './structured-account-binding'

export function createAntigravityModelCatalogProbe(
  deps: Pick<
    AntigravityLaunchDeps,
    'resolveEnvironment' | 'resolveCommandSettings' | 'readBinding' | 'probeVersion'
  > & {
    runListing?: typeof runAgentModelCatalogListing
  }
): AgentModelCatalogProbe {
  return async (accountHome, options) => {
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(await deps.resolveEnvironment())) {
      if (value !== undefined) {
        env[key] = value
      }
    }
    await (deps.readBinding ?? readAntigravityAccountBinding)({
      launchEnv: env,
      previous: accountHome
    })
    const command = resolveAntigravityCommand(env, deps.resolveCommandSettings?.())
    const cwd = homedir()
    const outcome = await antigravityCliVersionOutcome({ command, cwd, env }, deps.probeVersion)
    if (outcome !== 'supported') {
      throw new Error('Antigravity CLI does not support structured chats')
    }
    const output = await (deps.runListing ?? runAgentModelCatalogListing)(
      { command, cwd, env, args: ['models'] },
      {
        site: 'antigravity-model-catalog',
        signal: options?.signal
      }
    )
    const models = groupAntigravityModelVariants(parseAntigravityModels(output))
    if (models.length === 0) {
      throw new Error('Antigravity listed no models')
    }
    return { models, fastModeTierByModel: new Map(), origin: 'probe' }
  }
}
