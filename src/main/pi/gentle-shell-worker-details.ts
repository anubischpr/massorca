import { z } from 'zod'

// What Gentle Shell (gentle-pi, gentle-agents) publishes about a worker, its delegated subagent
// task: identity and state under `details.gentleAgents` on a `subagent_*` tool result or a
// completion message. Read exactly as published; a shape that does not match is ignored.

export const GENTLE_WORKER_RUN_TOOL = 'subagent_run'
export const GENTLE_WORKER_CANCEL_TOOL = 'subagent_cancel'
export const GENTLE_WORKER_RESULT_TYPE = 'gentle-agents.result'
export const GENTLE_WORKER_STALE_NOTICE_TYPE = 'gentle-agents.stale-notice'

export const GENTLE_WORKER_FINISHED_STATUSES = [
  'completed',
  'failed',
  'cancelled',
  'timed_out'
] as const

const workerDetailsSchema = z.looseObject({
  gentleAgents: z.looseObject({
    taskId: z.string().min(1).max(256),
    agent: z.string().optional(),
    status: z.enum(['queued', 'running', 'waiting', ...GENTLE_WORKER_FINISHED_STATUSES]),
    mode: z.enum(['task', 'background']).optional()
  })
})

export type GentleWorkerStatus = z.infer<typeof workerDetailsSchema>['gentleAgents']['status']

export type GentleWorkerFacts = {
  taskId: string
  agent?: string
  status: GentleWorkerStatus
  mode?: 'task' | 'background'
}

export function isFinishedGentleWorkerStatus(status: GentleWorkerStatus): boolean {
  return GENTLE_WORKER_FINISHED_STATUSES.some((finished) => finished === status)
}

/** A worker's identity and state as Gentle Shell published it on a tool result or completion. */
export function readGentleWorkerFacts(details: unknown): GentleWorkerFacts | undefined {
  const parsed = workerDetailsSchema.safeParse(details)
  if (!parsed.success) {
    return undefined
  }
  const { taskId, agent, status, mode } = parsed.data.gentleAgents
  return { taskId, status, ...(agent ? { agent } : {}), ...(mode ? { mode } : {}) }
}
