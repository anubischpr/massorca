import type { CreateChatNamingOverride } from '../../shared/create-chat-session-naming'
import type { ProjectlessChatWorkspaceResult } from '../../shared/projectless-chat-folder'
import type { TuiAgent } from '../../shared/tui-agent'

export type ProjectlessChatsApi = {
  /** Creates a dated folder workspace for a new chat without a project. */
  createWorkspace: (args: {
    createdWithAgent: TuiAgent
    createChatNaming: CreateChatNamingOverride
    connectionId?: string | null
  }) => Promise<ProjectlessChatWorkspaceResult>
}
