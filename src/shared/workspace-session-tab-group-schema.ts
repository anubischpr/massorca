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
