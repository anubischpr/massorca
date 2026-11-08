import { addTaskDeliverableFiles, botTeamDeliverableStoreDir } from './bot-team-deliverables-record'
import { namedFilesIn } from './bot-team-named-files'
import { NO_SKIPPED_FOLDERS } from './bot-team-finish-child-files'

/**
 * Files a project task wrote or named in its lines inside its worktree, added to the task's record
 * so the project's Files lists them even when git ignores them. Failing here never costs the room its report.
 */
export function registerFinishedTaskFiles(args: {
  storeDir?: string
  teamId: string
  taskId: string
  worktreePath: string
  written: readonly string[]
  ownLines: readonly { text: string }[]
}): void {
  try {
    const named = args.ownLines
      .flatMap((line) =>
        namedFilesIn(line.text, [{ path: args.worktreePath, skipFolders: NO_SKIPPED_FOLDERS }])
      )
      .map((file) => file.relative)
    addTaskDeliverableFiles(
      args.storeDir ?? botTeamDeliverableStoreDir(),
      args.teamId,
      args.taskId,
      [...new Set([...args.written, ...named])]
    )
  } catch (error) {
    console.warn('[bot-teams] could not register the files of a finished task', error)
  }
}
