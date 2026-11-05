import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { defineMethod } from '../../../core'
import { startFederatedWorker } from '../federation/federated-worker-start'
import { startLocalWorker } from './local-worker-start'
import { botRunOfWorkerCaller, refuseWorkerForDeniedBot } from './worker-bot-run'
import { assertWorkerStartAccessModeApplies } from './worker-start-access-mode'
import {
  decideWorkerStartMode,
  readWorkerStartModeSettings
} from '../../orchestration-worker-start-mode'
import { resolveOrchestrationCaller } from '../runs/run-scope'
import { WorkerStartParams } from './worker-start-schema'
import {
  isWorkerStartTimeoutWithinTimerLimit,
  resolveWorkerStartReadinessTimeoutMs
} from '../../../../../../shared/orchestration-timing-budgets'
import { assertWorkerStartTaskSpecWithinPromptBudget } from './worker-start-prompt-budget'
import { ORCA_SESSION_ADDRESS_PREFIX } from '../../../../../../shared/orca-session-address'
import { ORCHESTRATION_SESSION_CALLER_ERROR_CODES as SESSION_CODES } from '../../../../../../shared/orchestration-session-caller-codes'
import { delegatedChildFirstPrompt } from '../../../../../delegated-session/delegated-child-first-prompt'
import { delegatedChildPromptDeps } from '../../../../../delegated-session/delegated-child-prompt-deps'

export const ORCHESTRATION_WORKER_START_METHODS = [
  defineMethod({
    name: 'orchestration.workerStart',
    permission: 'workspace',
    params: WorkerStartParams,
    handler: async (
      params,
      { runtime, orchestrationMutation, orchestrationCompatibilityEvidence, orchestrationCaller }
    ) => {
      if (!isWorkerStartTimeoutWithinTimerLimit(params.timeoutMs)) {
        throw new OrchestrationError(
          'invalid_argument',
          '--timeout-ms is too large for worker-start transport grace; the derived timeout must fit within the timer limit.'
        )
      }
      const readinessTimeoutMs = resolveWorkerStartReadinessTimeoutMs(params.timeoutMs)
      const db = runtime.getOrchestrationDb()
      const coordinator = resolveOrchestrationCaller(runtime, {
        callerTerminalHandle: params.from,
        callerEvidence: orchestrationCompatibilityEvidence,
        callerSession: orchestrationCaller
      })
      const run = coordinator ? db.getCurrentRunForCoordinator(coordinator) : undefined
      if (!run || (params.run && params.run !== run.id)) {
        throw new OrchestrationError(
          'consumer_fenced',
          'worker-start requires the coordinator terminal currently bound to the Task Run.'
        )
      }
      const existingTask = params.task ? db.getTask(params.task) : undefined
      if (params.task && (!existingTask || existingTask.run_id !== run.id)) {
        throw new OrchestrationError(
          'task_not_found',
          `Task ${params.task} was not found in Run ${run.id}.`
        )
      }
      await assertWorkerStartTaskSpecWithinPromptBudget(params.spec ?? existingTask!.spec)
      const mode = decideWorkerStartMode({
        params,
        settings: readWorkerStartModeSettings(runtime)
      })
      if (params.on && params.terminal?.startsWith(ORCA_SESSION_ADDRESS_PREFIX)) {
        // Refused here, before any remote call: an Orca session ID names a chat only on its own host.
        throw new OrchestrationError(
          SESSION_CODES.hostBoundary,
          `${params.terminal} names a chat by its MassOrca session ID, which identifies it only on the host that runs it. Run worker-start on that host. No effects were applied.`,
          { effectsApplied: false }
        )
      }
      // Derived from the caller, never from the request: a worker inherits the bot that starts it.
      const botRun = botRunOfWorkerCaller(
        db,
        coordinator?.orcaSessionId ?? orchestrationCaller?.sessionId
      )
      if (params.on) {
        // Another server cannot be given the marker, so a bot kept out of an app may not start there.
        await refuseWorkerForDeniedBot(botRun, 'a worker on another server')
        // Refused before the remote call: a server that predates the field would ignore it silently.
        assertWorkerStartAccessModeApplies({
          requested: params.accessMode,
          terminal: params.terminal,
          on: params.on
        })
        // A remote worker is always a terminal agent; the mode receipt rides along so the
        // coordinator still learns why its structured default did not apply.
        const receipt = await startFederatedWorker({
          params,
          runtime,
          db,
          runId: run.id,
          task: existingTask,
          orchestrationMutation,
          callerSession: orchestrationCaller
        })
        return receipt && typeof receipt === 'object' ? { ...receipt, mode } : receipt
      }
      const originSessionId = orchestrationCaller?.sessionId
      return startLocalWorker({
        params: { ...params, timeoutMs: readinessTimeoutMs },
        runtime,
        db,
        run,
        coordinator,
        callerSession: orchestrationCaller,
        existingTask,
        orchestrationMutation,
        mode,
        ...(botRun ? { botRun } : {}),
        // Why: a child started over the CLI by a structured chat gets the same first prompt as a delegated child.
        ...(originSessionId === undefined
          ? {}
          : {
              firstPrompt: (childSessionId: string) =>
                delegatedChildFirstPrompt(
                  {
                    childSessionId,
                    originSessionId,
                    taskSpec: params.spec ?? existingTask?.spec ?? ''
                  },
                  delegatedChildPromptDeps(runtime)
                )
            })
      })
    }
  })
]
