import { z } from 'zod'

export const tabContentTypeSchema = z.enum([
  'terminal',
  'editor',
  'diff',
  'conflict-review',
  'check-details',
  'agent-session',
  'browser',
  'simulator',
  'checklist',
  'session-ref',
  'create-session'
])

export const workspaceVisibleTabTypeSchema = z.enum([
  'terminal',
  'editor',
  'agent-session',
  'browser',
  'simulator'
])
