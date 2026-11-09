import type { MarketplaceHostProgramResult } from '../../../shared/rpc-contract/marketplace-host-program-params'
import type { StandaloneProof } from './host-program-standalone'
import type {
  HostExecutor,
  PlanStep,
  ProgramPlan,
  ProgramSpec,
  RunResult
} from './host-program-types'

const MAX_MESSAGE_LENGTH = 300
const STANDALONE_REMOVAL_TIMEOUT_MS = 60_000

export type StepFailure = Extract<MarketplaceHostProgramResult, { ok: false }>

/** The last useful line a failed step printed, stripped of terminal escapes and cut short. */
export function failureMessage(result: RunResult): string {
  if (result.timedOut) {
    return 'The step took too long and was stopped.'
  }
  const text = `${result.stderr}\n${result.stdout}`
  const lines = text
    // oxlint-disable-next-line no-control-regex -- Why: host output must not carry terminal escapes onto the page.
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    // oxlint-disable-next-line no-control-regex -- Why: same as above, for the remaining control characters.
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .split(/\r?\n/)
  const last = lines.map((line) => line.trim()).findLast((line) => line.length > 0)
  return (last ?? `The step exited with code ${result.code ?? 'unknown'}.`).slice(
    0,
    MAX_MESSAGE_LENGTH
  )
}

function runStep(exec: HostExecutor, step: PlanStep): Promise<RunResult> {
  return step.script === undefined
    ? exec.run(step.argv ?? [], step.timeoutMs)
    : exec.script(step.script, step.timeoutMs)
}

/** Runs the plan in order; the first failing step ends it. */
export async function runPlan(exec: HostExecutor, plan: ProgramPlan): Promise<StepFailure | null> {
  for (const step of plan.steps) {
    const result = await runStep(exec, step)
    if (result.code === 0 && !result.timedOut) {
      continue
    }
    if (step.adminCheck) {
      return {
        ok: false,
        reason: 'needs-admin',
        message: 'This host needs an administrator. MassOrca never asks for a password.',
        command: plan.display
      }
    }
    return { ok: false, reason: 'failed', message: failureMessage(result), command: plan.display }
  }
  return null
}

export const couldNotCheck = (spec: ProgramSpec): StepFailure => ({
  ok: false,
  reason: 'failed',
  message: `Could not check ${spec.label} on this host.`
})

/** The removal of a standalone install whose path was proven; it deletes nothing else. */
export function standalonePlan(proof: StandaloneProof): ProgramPlan {
  return {
    method: 'script',
    steps: [{ script: proof.script, timeoutMs: STANDALONE_REMOVAL_TIMEOUT_MS }],
    display: proof.display,
    needsSudo: false,
    removedNote: `Removed ${proof.removed}. ${proof.note}`
  }
}
