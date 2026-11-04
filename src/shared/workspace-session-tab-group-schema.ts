import { z } from 'zod'

export const tabGroupSchema = z.object({
  id: z.string(),
  worktreeId: z.string(),
  activeTabId: z.string().nullable(),
  tabOrder: z.array(z.string()),
  recentTabIds: z.array(z.string()).optional(),
  // Why catch: a reference this build cannot read degrades to an ordinary empty pane instead of
  // failing the whole-session parse.
  sessionRef: z
    .object({ worktreeId: z.string().min(1), tabId: z.string().min(1) })
    .optional()
    .catch(undefined)
})

export const paneSessionFocusSchema = z.object({
  layoutWorktreeId: z.string().min(1),
  ownerWorktreeId: z.string().min(1),
  groupId: z.string().min(1)
})

// Why catch: a session tab whose reference this build cannot read closes on hydration instead of
// failing the whole-session parse.
export const tabSessionRefSchema = z
  .object({
    worktreeId: z.string().min(1),
    tabId: z.string().min(1),
    endsSessionOnClose: z.literal(true).optional().catch(undefined)
  })
  .optional()
  .catch(undefined)
