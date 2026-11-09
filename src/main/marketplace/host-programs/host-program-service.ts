import type {
  MarketplaceHostProgramId,
  MarketplaceHostProgramMethod,
  MarketplaceHostProgramResult,
  MarketplaceHostProgramStatus
} from '../../../shared/rpc-contract/marketplace-host-program-params'
import { programSpec } from './host-program-catalog'
import {
  inspectProgram,
  type ProgramInspection,
  type ProgramOwner
} from './host-program-inspection'
import { gatherHostFacts, planInstall, planRemoval, type HostFacts } from './host-program-plan'
import { couldNotCheck, failureMessage, runPlan, standalonePlan } from './host-program-run'
import type { HostExecutor, ProgramPlan, ProgramSpec } from './host-program-types'

function methodOf(owner: ProgramOwner): MarketplaceHostProgramMethod {
  switch (owner.kind) {
    case 'option':
      return owner.option.method
    case 'native':
      return 'script'
    case 'version-manager':
      return 'version-manager'
    case 'unknown':
      return 'unknown'
  }
}

/** The vendor's own command for this platform, shown when MassOrca cannot run it itself. */
export function vendorInstallCommand(spec: ProgramSpec, facts: HostFacts): string | undefined {
  const option = spec.options[facts.platform].find((candidate) => candidate.installable !== false)
  if (!option) {
    return undefined
  }
  switch (option.method) {
    case 'script':
      return option.display
    case 'winget':
      return `winget install --id ${option.id} -e`
    case 'brew':
      return `brew install ${option.cask ? '--cask ' : ''}${option.name}`
    case 'npm':
      return `npm install -g ${option.pkg}`
    case 'apt':
    case 'dnf': {
      const manager = option.method === 'apt' ? 'apt-get' : 'dnf'
      return `${facts.isRoot ? '' : 'sudo '}${manager} install -y ${option.pkgs.join(' ')}`
    }
  }
}

export type Removal = { plan: ProgramPlan } | { why: string }
export type Found = Extract<ProgramInspection, { state: 'found' }>

export function removalFor(spec: ProgramSpec, found: Found, facts: HostFacts): Removal {
  const { owner, path, standalone } = found
  if (owner.kind === 'version-manager') {
    return {
      why: `${spec.label} at ${path} comes from a version manager. Remove it with that tool.`
    }
  }
  if (owner.kind === 'option') {
    const plan = planRemoval(owner.option, facts)
    return plan ? { plan } : { why: `MassOrca has no removal for ${spec.label} at ${path}.` }
  }
  // Why only a proof: the vendor documents no uninstaller, so a delete needs the exact installer path.
  if (standalone) {
    return { plan: standalonePlan(standalone) }
  }
  return owner.kind === 'unknown'
    ? {
        why: `MassOrca cannot tell how ${spec.label} at ${path} was installed. Remove it with the tool that installed it, or reinstall it with MassOrca.`
      }
    : {
        why: `${spec.label} at ${path} did not come from the vendor's default install folder, so MassOrca will not delete it. Remove it by hand, or reinstall it with MassOrca.`
      }
}

export async function inspectOnHost(id: MarketplaceHostProgramId, exec: HostExecutor) {
  const spec = programSpec(id)
  const facts = await gatherHostFacts(exec)
  return { spec, facts, inspection: await inspectProgram(spec, exec, facts) }
}

export { failureMessage }

export async function installHostProgram(
  id: MarketplaceHostProgramId,
  exec: HostExecutor
): Promise<MarketplaceHostProgramResult> {
  const { spec, facts, inspection } = await inspectOnHost(id, exec)
  if (inspection.state === 'unverifiable') {
    return couldNotCheck(spec)
  }
  if (inspection.state === 'found') {
    return { ok: true, ...(inspection.version ? { version: inspection.version } : {}) }
  }
  const plan = planInstall(spec, facts)
  if (!plan) {
    const command = vendorInstallCommand(spec, facts)
    return {
      ok: false,
      reason: 'unsupported',
      message: `MassOrca has no install for ${spec.label} that fits this host.`,
      ...(command ? { command } : {})
    }
  }
  const failure = await runPlan(exec, plan)
  if (failure) {
    return failure
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
  return { ok: true, ...(after.version ? { version: after.version } : {}) }
}

export async function uninstallHostProgram(
  id: MarketplaceHostProgramId,
  exec: HostExecutor
): Promise<MarketplaceHostProgramResult> {
  const { spec, facts, inspection } = await inspectOnHost(id, exec)
  if (inspection.state === 'unverifiable') {
    return couldNotCheck(spec)
  }
  if (inspection.state === 'absent') {
    return { ok: false, reason: 'not-installed' }
  }
  const removal = removalFor(spec, inspection, facts)
  if ('why' in removal) {
    return { ok: false, reason: 'unsupported', message: removal.why }
  }
  const failure = await runPlan(exec, removal.plan)
  if (failure) {
    return failure
  }
  const after = await exec.which(spec.command)
  if (after.state === 'found') {
    return {
      ok: false,
      reason: 'failed',
      message: `Another copy of ${spec.label} remains at ${after.path}.`
    }
  }
  return { ok: true, ...(removal.plan.removedNote ? { message: removal.plan.removedNote } : {}) }
}

/** A copy MassOrca can move to its managed install: one it cannot name, or the vendor's own installer folder. */
export function reinstallPlanFor(
  spec: ProgramSpec,
  found: Found,
  facts: HostFacts
): ProgramPlan | null {
  return found.owner.kind === 'native' || found.owner.kind === 'unknown'
    ? planInstall(spec, facts)
    : null
}

export async function hostProgramStatus(
  id: MarketplaceHostProgramId,
  exec: HostExecutor
): Promise<MarketplaceHostProgramStatus> {
  const { spec, facts, inspection } = await inspectOnHost(id, exec)
  if (inspection.state === 'unverifiable') {
    return couldNotCheck(spec)
  }
  if (inspection.state === 'absent') {
    const plan = planInstall(spec, facts)
    const command = plan?.display ?? vendorInstallCommand(spec, facts)
    return {
      ok: true,
      installed: false,
      canInstall: plan !== null,
      canUninstall: false,
      ...(command ? { installCommand: command } : {}),
      ...(plan ? {} : { note: `MassOrca has no install for ${spec.label} that fits this host.` })
    }
  }
  const removal = removalFor(spec, inspection, facts)
  const reinstall = reinstallPlanFor(spec, inspection, facts)
  return {
    ok: true,
    installed: true,
    path: inspection.path,
    method: methodOf(inspection.owner),
    canInstall: false,
    canUninstall: 'plan' in removal,
    ...(reinstall ? { canReinstall: true, reinstallCommand: reinstall.display } : {}),
    ...(inspection.version ? { version: inspection.version } : {}),
    ...('plan' in removal ? { uninstallCommand: removal.plan.display } : { note: removal.why })
  }
}
