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
import type { HostExecutor, HostPlatform, ProgramPlan } from './host-program-types'

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
  // Why inspect first: the old copy goes only after the new one is seen resolving on the PATH and running.
  const after = await inspectProgram(spec, exec, facts)
  if (after.state !== 'found') {
    return {
      ok: false,
      reason: 'failed',
      message: `${spec.label} installed, but it is not on this host's PATH yet. The old copy at ${inspection.path} was left in place.`,
      command: plan.display
    }
  }
  // Why not for a script reinstall: it writes to the same place the old copy sits, so removing it would remove the new one.
  const replacesInPlace = plan.method === 'script' && inspection.standalone !== undefined
  const newCopyWorks =
    after.version !== undefined && !samePath(after.path, inspection.path, facts.platform)
  const removal =
    inspection.standalone && !replacesInPlace && newCopyWorks
      ? standalonePlan(inspection.standalone)
      : null
  if (removal) {
    const removalFailure = await runPlan(exec, removal)
    if (removalFailure) {
      return {
        ok: false,
        reason: 'failed',
        message: `${spec.label} was installed, but the old copy was not removed: ${removalFailure.message ?? 'the step failed.'}`
      }
    }
    if ((await exec.which(spec.command)).state !== 'found') {
      return {
        ok: false,
        reason: 'failed',
        message: `${spec.label} is no longer on this host's PATH after the old copy was removed.`
      }
    }
  }
  return {
    ok: true,
    ...(after.version ? { version: after.version } : {}),
    ...(keptOldMessage(removal, replacesInPlace, newCopyWorks, inspection.path, after.path)
      ? {
          message: keptOldMessage(
            removal,
            replacesInPlace,
            newCopyWorks,
            inspection.path,
            after.path
          )
        }
      : {})
  }
}

function samePath(a: string, b: string, platform: HostPlatform): boolean {
  return platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function keptOldMessage(
  removal: ProgramPlan | null,
  replacesInPlace: boolean,
  newCopyWorks: boolean,
  oldPath: string,
  newPath: string
): string | undefined {
  if (removal) {
    return removal.removedNote
  }
  if (replacesInPlace) {
    return undefined
  }
  return newCopyWorks
    ? `The old copy at ${oldPath} was left in place.`
    : `The old copy at ${oldPath} was left in place, because the new copy at ${newPath} does not come first on the PATH and run.`
}
