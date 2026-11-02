import type { PrototypeSetTitleGenerator } from '../native-chat/prototype-set-title'
import {
  onBotTeamTaskCreated,
  renameBotTeamTask
} from '../runtime/orchestration/db/bot-teams/bot-team-room-store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { botTeamFolderPath } from './bot-team-version-deps'

/**
 * Names each new task the way sessions and worktrees are named; the first line stays as its title
 * until the name arrives, and the whole request stays as the task's prompt.
 */
export function nameBotTeamTasksWith(generate: PrototypeSetTitleGenerator): () => void {
  return onBotTeamTaskCreated((db, task) => {
    void generate({ originalPrompt: task.prompt, launchDirectory: botTeamFolderPath(task.teamId) })
      .then((name) => {
        if (name && name !== task.title) {
          renameBotTeamTask(db, task.id, task.title, name)
        }
      })
      .catch(() => {
        // The first line is a fine title; naming is a nicety.
      })
  })
}

let started = false

export function startBotTeamTaskNaming(runtime: OrcaRuntimeService): void {
  if (started) {
    return
  }
  started = true
  nameBotTeamTasksWith(runtime.prototypeSetTitles())
}
