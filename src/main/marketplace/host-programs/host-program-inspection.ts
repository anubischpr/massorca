import { proveStandalone, type StandaloneProof } from './host-program-standalone'
import { ownershipProbe, type HostFacts } from './host-program-plan'
import type { HostExecutor, InstallOption, ProgramSpec } from './host-program-types'

const PROBE_TIMEOUT_MS = 20_000
const VERSION_MANAGER_PATH =
  /[\\/](?:\.nvm|nvm4w|nvm|\.fnm|fnm|\.volta|\.asdf|\.mise|\.nodenv)[\\/]/i

export type ProgramOwner =
  | { kind: 'option'; option: InstallOption }
  | { kind: 'native' }
  | { kind: 'version-manager' }
  | { kind: 'unknown' }

export type ProgramInspection =
  | { state: 'absent' }
  | { state: 'unverifiable' }
  | {
      state: 'found'
      path: string
      version?: string
      owner: ProgramOwner
      /** Set when the binary is proven to be the vendor installer's own, which makes it removable. */
      standalone?: StandaloneProof
    }

function firstLine(text: string): string | undefined {
  // oxlint-disable-next-line no-control-regex -- Why: a version line from a host must not carry terminal escapes.
  const line = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  return line ? line.slice(0, 120) : undefined
}

// Why: asking a package manager the host does not have only burns a spawn.
function managerPresent(option: InstallOption, facts: HostFacts): boolean {
  return option.method === 'winget' || option.method === 'brew' || option.method === 'npm'
    ? facts.has.has(option.method)
    : option.method === 'apt' || option.method === 'dnf'
}

async function readOwner(
  spec: ProgramSpec,
  exec: HostExecutor,
  facts: HostFacts,
  path: string
): Promise<ProgramOwner> {
  if (spec.versionManaged && VERSION_MANAGER_PATH.test(path)) {
    return { kind: 'version-manager' }
  }
  for (const option of spec.options[facts.platform]) {
    const probe = ownershipProbe(option)
    if (!probe || !managerPresent(option, facts)) {
      continue
    }
    if (probe.owned(await exec.run(probe.argv, PROBE_TIMEOUT_MS))) {
      return { kind: 'option', option }
    }
  }
  return spec.nativePath?.test(path) ? { kind: 'native' } : { kind: 'unknown' }
}

/** Whether the program is on the host, which version, and which installer owns it. */
export async function inspectProgram(
  spec: ProgramSpec,
  exec: HostExecutor,
  facts: HostFacts
): Promise<ProgramInspection> {
  const found = await exec.which(spec.command)
  if (found.state !== 'found') {
    return { state: found.state }
  }
  const [versionRun, owner] = await Promise.all([
    exec.run([spec.command, '--version'], PROBE_TIMEOUT_MS),
    readOwner(spec, exec, facts, found.path)
  ])
  const version =
    versionRun.code === 0 ? firstLine(versionRun.stdout.split('\n')[0] ?? '') : undefined
  const standalone =
    owner.kind === 'native' || owner.kind === 'unknown'
      ? await proveStandalone(spec.id, exec, facts, found.path)
      : null
  return {
    state: 'found',
    path: found.path,
    owner,
    ...(version ? { version } : {}),
    ...(standalone ? { standalone } : {})
  }
}
