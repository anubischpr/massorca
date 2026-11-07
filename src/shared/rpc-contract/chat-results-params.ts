import { z } from 'zod'
import type { NativeChatEnvironmentUrl } from '../native-chat-environment-urls'

export const ListChatResultsParams = z.object({ sessionId: z.string().min(1).max(512) }).strict()

export type ListChatResultsParams = z.infer<typeof ListChatResultsParams>

/** A chat's Results as its execution host reads them from the newest journal page. `hasOlder`
 *  says older history was not read, so results only it holds are missing. */
export type ListChatResultsResult = {
  sessionId: string
  urls: NativeChatEnvironmentUrl[]
  /** Changed file paths as the journal records them, newest touch first. */
  files: string[]
  hasOlder: boolean
}
