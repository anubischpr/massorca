import { z } from 'zod'
import {
  NATIVE_CHAT_CHECKLIST_ITEM_MAX_LENGTH,
  NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS,
  NATIVE_CHAT_CHECKLIST_NOTE_MAX_LENGTH,
  NATIVE_CHAT_CHECKLIST_TITLE_MAX_LENGTH,
  type NativeChatChecklistPersonState
} from '../native-chat-checklist'
import { SessionId } from './structured-agent-session-identifiers'

// `agentSessionChecklist.*`: the person's checks, notes and screenshots on a chat's checklist,
// kept by the host that owns the chat. The agent's items come from its replies, not from here.

export const ChecklistReadParams = z.object({ sessionId: SessionId }).strict()

const Screenshot = z
  .object({ path: z.string().min(1).max(4096), name: z.string().min(1).max(1024) })
  .strict()

export const ChecklistSetItemParams = z
  .object({
    sessionId: SessionId,
    /** The list's title as the client shows it, so the host can name it to the agent. */
    title: z.string().max(NATIVE_CHAT_CHECKLIST_TITLE_MAX_LENGTH).nullable().optional(),
    text: z.string().min(1).max(NATIVE_CHAT_CHECKLIST_ITEM_MAX_LENGTH),
    checked: z.boolean().optional(),
    /** Empty string clears the note. */
    note: z.string().max(NATIVE_CHAT_CHECKLIST_NOTE_MAX_LENGTH).optional(),
    /** Host paths from `agentSessionAttachment.uploadCommit`; replaces the item's screenshots. */
    screenshots: z.array(Screenshot).max(NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS).optional()
  })
  .strict()

export type AgentSessionChecklistSetItemParams = z.infer<typeof ChecklistSetItemParams>

export type AgentSessionChecklistResult =
  | { ok: true; state: NativeChatChecklistPersonState }
  | { ok: false; error: 'session_not_found' }
