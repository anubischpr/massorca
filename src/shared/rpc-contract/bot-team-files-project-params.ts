import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamProjectFilesSelector = z.object({
  teamId: requiredString('Missing team id')
})

/** A file a team's bot tasks changed or made in a linked project, opened where it is. */
export type BotTeamProjectFile = {
  /** The workspace the file is in: a task's worktree, or a folder project's folder. */
  workspaceId: string
  relativePath: string
  basename: string
  kind: 'text' | 'binary'
}

/** The files of each linked project a team's finished tasks touched, newest first. */
export type BotTeamProjectFiles = {
  projects: { projectId: string; name: string; files: BotTeamProjectFile[] }[]
  /** True when the host stopped listing at its cap. */
  truncated: boolean
}
