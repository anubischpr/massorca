import { readAntigravityAccountBinding } from './structured-account-binding'
import { prepareAntigravityAccountForLaunch } from './native-account-launch'
import { ANTIGRAVITY_STRUCTURED_AGENT } from './structured-agent-definition'
import { AntigravityStructuredSessionAdapter } from './structured-session-adapter'
import {
  antigravityCliUnavailableReason,
  antigravityCliVersionOutcome,
  createAntigravityLaunchResolver,
  resolveAntigravityCommand
} from './structured-launch-resolution'
import { createAntigravityModelCatalogProbe } from './model-catalog-probe'
import { ensureDelegationInstructionsFolder } from '../delegated-session/delegation-instructions-folder'
import { supportsSupervisedProviderChildLocation } from '../provider-process/supervised-provider-child-location'
import { isAgentSessionPreSpawnError } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { createStructuredAgentEnvironmentResolvers } from '../runtime/structured-agent-shell-environment'
import { nativeChatShellEnvironmentPolicy } from '../../shared/native-chat-shell-environment'
import type {
  StructuredAgentRuntimeRegistration,
  StructuredAgentModelCatalogContext
} from '../runtime/structured-agent-runtime-registrations'

function environmentFor(context: StructuredAgentModelCatalogContext) {
  return async () => ({
    ...(await context.environment.resolveBaseEnvironment()),
    ...context.deps.resolveAgentLaunchEnv?.('antigravity')
  })
}

export const ANTIGRAVITY_RUNTIME_REGISTRATION: StructuredAgentRuntimeRegistration = {
  definition: ANTIGRAVITY_STRUCTURED_AGENT,
  supportsLocation: supportsSupervisedProviderChildLocation,
  supportsLaunch: async ({ cwd, env, commandSettings }) => {
    try {
      const outcome = await antigravityCliVersionOutcome({
        cwd,
        env,
        command: resolveAntigravityCommand(env, commandSettings)
      })
      return outcome === 'supported' ? true : antigravityCliUnavailableReason(outcome)
    } catch (error) {
      if (isAgentSessionPreSpawnError(error)) {
        return true
      }
      throw error
    }
  },
  resolveAccountHome: async ({ launchEnv, purpose }, services) => {
    // Create/catalog requests carry agent overrides, while account binding requires the child's full environment.
    const environment = createStructuredAgentEnvironmentResolvers({
      resolveShellEnvironmentPolicy: () =>
        nativeChatShellEnvironmentPolicy(services.workspaceTrustSettings())
    })
    const env = { ...(await environment.resolveBaseEnvironment()), ...launchEnv }
    if (purpose === 'launch') {
      await prepareAntigravityAccountForLaunch({
        launchAgent: 'antigravity',
        env,
        envIsComplete: true
      })
    }
    return readAntigravityAccountBinding({ launchEnv: env })
  },
  modelCatalog: (context) => ({
    kind: 'probe',
    listingNamesConfiguredModel: false,
    probe: createAntigravityModelCatalogProbe({
      resolveEnvironment: environmentFor(context),
      ...(context.deps.resolveAgentCommandSettings
        ? { resolveCommandSettings: context.deps.resolveAgentCommandSettings }
        : {})
    })
  }),
  createAdapter: (context) =>
    new AntigravityStructuredSessionAdapter({
      resolveLaunch: createAntigravityLaunchResolver({
        store: context.store,
        resolveWorkspacePath: context.deps.resolveWorkspacePath,
        resolveEnvironment: environmentFor(context),
        ...(context.deps.resolveAgentCommandSettings
          ? { resolveCommandSettings: context.deps.resolveAgentCommandSettings }
          : {}),
        ...(context.deps.resolveAgentFullAccess
          ? { resolveFullAccess: () => context.deps.resolveAgentFullAccess!('antigravity') }
          : {}),
        resolveLaunchArgs: () => context.deps.resolveLaunchArgs('antigravity'),
        resolveDelegationInstructionsFolder: () =>
          ensureDelegationInstructionsFolder(context.deps.stateDirectory),
        logger: context.deps.logger
      }),
      ...(context.deps.readProcessStartTime
        ? { readProcessStartTime: context.deps.readProcessStartTime }
        : {}),
      logger: context.deps.logger,
      onChildWorkEvidence: (sessionId, evidence) =>
        context.host()?.publishChildWorkEvidence(sessionId, evidence),
      onLifecycle: context.deliverLifecycle,
      onIdle: context.followUps.releaseUnansweredDispatches,
      onSettled: ({ sessionId, clientMessageId, outcome }) => {
        if (outcome.state === 'admitted') {
          return
        }
        context.followUps.onDispatchSettledLate({
          sessionId,
          clientMessageId,
          ...(outcome.state === 'accepted'
            ? { providerIdentity: outcome.providerIdentity }
            : outcome)
        })
      }
    })
}
