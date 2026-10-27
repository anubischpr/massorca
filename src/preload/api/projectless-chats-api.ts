import type { ProjectlessChatWorkspaceResult } from '../../shared/projectless-chat-folder'

export type ProjectlessChatsApi = {
  /** Creates a dated folder workspace for a new chat without a project. */
  createWorkspace: (args: {
    title?: string
    connectionId?: string | null
  }) => Promise<ProjectlessChatWorkspaceResult>
}
