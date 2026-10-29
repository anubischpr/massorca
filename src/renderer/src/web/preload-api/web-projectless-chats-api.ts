import type { ProjectlessChatsApi } from '../../../../preload/api/projectless-chats-api'

// Why: the browser build has no filesystem to create a chat folder in.
export function createWebProjectlessChatsApi(): ProjectlessChatsApi {
  return {
    createWorkspace: async () => ({
      ok: false,
      code: 'web_runtime_unsupported'
    })
  }
}
