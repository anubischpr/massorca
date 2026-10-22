import { z } from 'zod'

// What Gentle Shell (gentle-pi) publishes about a background job: its identity and state under
// `details.gentleJobs` on a job tool result or an exit notice. Read exactly as published; a shape
// that does not match is ignored, never repaired.

export const GENTLE_BASH_BACKGROUND_TOOL = 'bash_background'
export const GENTLE_MONITOR_TOOL = 'monitor'
export const GENTLE_JOB_STOP_TOOL = 'job_stop'
export const GENTLE_JOB_NOTICE_TYPE = 'gentle-jobs.notice'

const jobDetailsSchema = z.looseObject({
  gentleJobs: z.looseObject({
    jobId: z.string().min(1).max(256),
    kind: z.enum(['command', 'monitor']).optional(),
    label: z.string().optional(),
    status: z.enum(['running', 'exited', 'stopped', 'failed']),
    exitCode: z.number().int().nullable().optional(),
    outputPath: z.string().optional(),
    event: z.enum(['events', 'timeout', 'flood']).optional()
  })
})

const unreadableExitSchema = z.looseObject({
  gentleJobs: z.looseObject({
    jobId: z.string().min(1).max(256),
    status: z.string().min(1),
    event: z.unknown().optional()
  })
})

/** The job id of an exit notice whose status the strict reader does not know, or undefined. A
 *  `running` status or an `event` field is never an exit. */
export function readGentleJobUnreadableExit(details: unknown): string | undefined {
  const parsed = unreadableExitSchema.safeParse(details)
  if (!parsed.success) {
    return undefined
  }
  const { jobId, status, event } = parsed.data.gentleJobs
  return status === 'running' || event !== undefined ? undefined : jobId
}

export type GentleJobFacts = {
  jobId: string
  kind: 'command' | 'monitor'
  label?: string
  status: 'running' | 'exited' | 'stopped' | 'failed'
  exitCode?: number | null
  event?: 'events' | 'timeout' | 'flood'
}

/** A job's identity and state as Gentle Shell published it on a tool result or exit notice. */
export function readGentleJobFacts(details: unknown, fallbackKind: 'command' | 'monitor') {
  const parsed = jobDetailsSchema.safeParse(details)
  if (!parsed.success) {
    return undefined
  }
  const job = parsed.data.gentleJobs
  const facts: GentleJobFacts = {
    jobId: job.jobId,
    kind: job.kind ?? fallbackKind,
    status: job.status,
    ...(job.label ? { label: job.label } : {}),
    ...(job.exitCode !== undefined ? { exitCode: job.exitCode } : {}),
    ...(job.event ? { event: job.event } : {})
  }
  return facts
}
