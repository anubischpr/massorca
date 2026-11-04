import {
  delegatedChildFirstPrompt,
  type DelegatedChildFirstPromptDeps
} from '../delegated-session/delegated-child-first-prompt'
import { delegatedChildPromptDeps } from '../delegated-session/delegated-child-prompt-deps'
import {
  withBotTeamPrototypeChoice,
  type BotTeamPrototypeChoice
} from '../../shared/bot-team-prototype-choice'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { BotTeamPrototypeFirstPrompt } from './bot-team-task-start'

/**
 * The prototype first prompt of a bot's task: the person already answered the count, so the task is a
 * prototype task. A room has no lead session, so the bot's own session is the request's origin.
 */
export function botTeamPrototypeFirstPrompt(
  runtime: OrcaRuntimeService,
  deps: DelegatedChildFirstPromptDeps = delegatedChildPromptDeps(runtime)
): BotTeamPrototypeFirstPrompt {
  return (input) =>
    delegatedChildFirstPrompt(
      {
        childSessionId: input.childSessionId,
        originSessionId: input.childSessionId,
        taskSpec: input.taskSpec,
        count: input.count,
        ...(input.designSystem ? { designSystem: input.designSystem } : {}),
        prototypeTask: true
      },
      deps
    )
}

/**
 * Keeps the person's count in an unstarted task's start notes, so it reaches the start whether the task
 * runs now or from Todo later. `startTask` runs the task after its choice is kept.
 */
export function keepBotTeamPrototypeChoice(
  db: OrchestrationDb,
  choice: BotTeamPrototypeChoice | undefined
): {
  keep: (task: BotTeamTask | null) => void
  startKept: (
    startTask: (taskId: string) => Promise<BotTeamTask>
  ) => (taskId: string) => Promise<BotTeamTask>
} {
  const keep = (task: BotTeamTask | null): void => {
    if (choice && task && task.sessionId === null) {
      db.setBotTeamTaskStartNotes(
        task.id,
        withBotTeamPrototypeChoice(db.getBotTeamTaskStartNotes(task.id), choice)
      )
    }
  }
  return {
    keep,
    startKept: (startTask) => (taskId) => {
      keep(db.getBotTeamTask(taskId))
      return startTask(taskId)
    }
  }
}
