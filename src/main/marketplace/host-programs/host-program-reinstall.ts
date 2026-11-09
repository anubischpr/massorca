import type {
  MarketplaceHostProgramId,
  MarketplaceHostProgramResult
} from '../../../shared/rpc-contract/marketplace-host-program-params'
import { inspectProgram } from './host-program-inspection'
import { couldNotCheck, runPlan, standalonePlan } from './host-program-run'
import {
  inspectOnHost,
  installHostProgram,
  reinstallPlanFor,
  vendorInstallCommand
} from './host-program-service'
import type { HostExecutor } from './host-program-types'

/**
 * Moves a copy MassOrca cannot remove on its own to the managed install. The managed copy goes in
 * first; only a standalone folder whose path was proven is then removed, and nothing else is deleted.
 */
export async function reinstallHostProgram(
  id: MarketplaceHostProgramId,
  exec: HostExecutor
): Promise<MarketplaceHostProgramResult> {
  const { spec, facts, inspection } = await inspectOnHost(id, exec)
  if (inspection.state === 'unverifiable') {
    return couldNotCheck(spec)
  }
  if (inspection.state === 'absent') {
    return installHostProgram(id, exec)
  }
  const plan = reinstallPlanFor(spec, inspection, facts)
  if (!plan) {
    const command = vendorInstallCommand(spec, facts)
    return {
      ok: false,
      reason: 'unsupported',
      message: `${spec.label} at ${inspection.path} is already managed by its installer. Use Uninstall, then Install.`,
      ...(command ? { command } : {})
    }
  }
  const failure = await runPlan(exec, plan)
  if (failure) {
    return failure
  }
  // Why not for a script reinstall: it writes to the same place the old copy sits, so removing it would remove the new one.
  const removal =
    inspection.standalone && plan.method !== 'script' ? standalonePlan(inspection.standalone) : null
  if (removal) {
    const removalFailure = await runPlan(exec, removal)
    if (removalFailure) {
      return {
        ok: false,
        reason: 'failed',
        message: `${spec.label} was installed, but the old copy was not removed: ${removalFailure.message ?? 'the step failed.'}`
      }
    }
  }
  const after = await inspectProgram(spec, exec, facts)
  if (after.state !== 'found') {
    return {
      ok: false,
      reason: 'failed',
      message: `${spec.label} installed, but it is not on this host's PATH yet.`,
      command: plan.display
    }
  }
  const keptOld = !removal && !(plan.method === 'script' && inspection.standalone)
  const message = removal
    ? removal.removedNote
    : keptOld
      ? `The old copy at ${inspection.path} was left in place and may still come first on the PATH.`
      : undefined
  return {
    ok: true,
    ...(after.version ? { version: after.version } : {}),
    ...(message ? { message } : {})
  }
}
