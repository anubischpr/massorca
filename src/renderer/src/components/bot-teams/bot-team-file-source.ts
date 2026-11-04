import type {
  RuntimeFilePreviewResult,
  RuntimeFileReadResult
} from '../../../../shared/runtime-file-contracts'
import { readBotTeamFile } from '@/runtime/runtime-bot-team-client'
import {
  readBotTeamProjectFile,
  readBotTeamProjectFilePreview
} from '../../runtime/runtime-bot-team-client-project-files'
import { readBotTeamFilePreview } from './bot-team-file-preview-read'

/** Where a file a team's Files lists lives: the team's own folder, or a linked project's workspace. */
export type BotTeamFileLocation = {
  teamId: string
  relativePath: string
  /** The project workspace the file is in; null for the team's own folder. */
  workspaceId: string | null
}

/** The key a file's read state is kept under: its place, then its path. */
export function botTeamFileKey(file: { relativePath: string; workspaceId: string | null }): string {
  return file.workspaceId === null
    ? `team:${file.relativePath}`
    : `project:${file.workspaceId}:${file.relativePath}`
}

/** The keys of every file a team's Files lists now, the team folder's and its projects'. */
export function listedBotTeamFileKeys(
  teamPaths: readonly string[],
  projectFiles: readonly { workspaceId: string; relativePath: string }[]
): string[] {
  return [
    ...teamPaths.map((relativePath) => botTeamFileKey({ relativePath, workspaceId: null })),
    ...projectFiles.map((file) => botTeamFileKey(file))
  ]
}

/** A file's text, from the team's folder or from its project workspace. */
export function readBotTeamFileText(
  location: BotTeamFileLocation
): Promise<RuntimeFileReadResult | 'unavailable'> {
  return location.workspaceId === null
    ? readBotTeamFile(location.teamId, location.relativePath)
    : readBotTeamProjectFile(location.workspaceId, location.relativePath)
}

/** A file's preview, from the team's folder or from its project workspace. */
export function readBotTeamFilePreviewOf(
  location: BotTeamFileLocation
): Promise<RuntimeFilePreviewResult> {
  return location.workspaceId === null
    ? readBotTeamFilePreview(location.teamId, location.relativePath)
    : readBotTeamProjectFilePreview(location.workspaceId, location.relativePath)
}
