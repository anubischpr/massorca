import type { MarketplaceHostProgramId } from '../../../shared/rpc-contract/marketplace-host-program-params'
import type { HostFacts } from './host-program-plan'
import type { HostExecutor, HostPlatform } from './host-program-types'

const PROOF_TIMEOUT_MS = 15_000

/** A removal MassOrca may run because the binary was proven to sit where the vendor's installer puts it. */
export type StandaloneProof = {
  script: string
  display: string
  /** The path the removal takes away, for the result message. */
  removed: string
  note: string
}

type StandaloneInstall = {
  /** The exact command path the vendor installer leaves; null when the host did not say where its home is. */
  binary: (facts: HostFacts) => string | null
  /** How the POSIX command must look: a symlink into the installer layout, or a plain file the installer copied. */
  shape: 'windows' | { link: RegExp } | 'file'
  script: string
  removed: (facts: HostFacts) => string
  note: string
}

const WINDOWS_CODEX_SCRIPT =
  "[System.IO.Directory]::Delete((Join-Path $env:LOCALAPPDATA 'Programs\\OpenAI\\Codex'), $true)"

// Why .NET Delete and not Remove-Item: the installer's bin folder is a junction into ~/.codex, and
// Directory.Delete unlinks a junction without following it, so nothing under ~/.codex is reached.
const CODEX_WINDOWS: StandaloneInstall = {
  binary: (facts) =>
    facts.localAppData ? `${facts.localAppData}\\Programs\\OpenAI\\Codex\\bin\\codex.exe` : null,
  shape: 'windows',
  script: WINDOWS_CODEX_SCRIPT,
  removed: (facts) => `${facts.localAppData}\\Programs\\OpenAI\\Codex`,
  note: 'Your ~\\.codex folder was not touched.'
}

const CODEX_POSIX: StandaloneInstall = {
  binary: (facts) => (facts.home ? `${facts.home}/.local/bin/codex` : null),
  // Why: the installer symlinks the command to the release it unpacked under ~/.codex/packages/standalone.
  shape: { link: /(?:^|\/)packages\/standalone\/current\/(?:bin\/)?codex$/ },
  script:
    'for f in "$HOME/.local/bin/codex" "$HOME/.local/bin/codex-code-mode-host"; do if [ -L "$f" ]; then rm -f "$f"; fi; done',
  removed: (facts) => `${facts.home}/.local/bin/codex`,
  note: 'The unpacked release stays under ~/.codex/packages/standalone, which MassOrca never touches.'
}

const AGY_WINDOWS: StandaloneInstall = {
  binary: (facts) => (facts.localAppData ? `${facts.localAppData}\\agy\\bin\\agy.exe` : null),
  shape: 'windows',
  // Why: only bin is the installer's; the agy folder goes too only when nothing else lives in it.
  script:
    "$root = Join-Path $env:LOCALAPPDATA 'agy'; $bin = Join-Path $root 'bin'; if (Test-Path -LiteralPath $bin) { [System.IO.Directory]::Delete($bin, $true) }; if ((Test-Path -LiteralPath $root) -and -not (Get-ChildItem -LiteralPath $root -Force)) { [System.IO.Directory]::Delete($root) }",
  removed: (facts) => `${facts.localAppData}\\agy\\bin`,
  note: 'Anything else in the agy folder, and your Antigravity settings, were not touched.'
}

const AGY_POSIX: StandaloneInstall = {
  binary: (facts) => (facts.home ? `${facts.home}/.local/bin/agy` : null),
  shape: 'file',
  script:
    'if [ -f "$HOME/.local/bin/agy" ] && [ ! -L "$HOME/.local/bin/agy" ]; then rm -f "$HOME/.local/bin/agy"; fi',
  removed: (facts) => `${facts.home}/.local/bin/agy`,
  note: 'Your Antigravity settings were not touched.'
}

// Why only these: each row is a default target read from the vendor's own installer script.
const STANDALONE: Partial<
  Record<MarketplaceHostProgramId, Partial<Record<HostPlatform, StandaloneInstall>>>
> = {
  codex: { win32: CODEX_WINDOWS, darwin: CODEX_POSIX, linux: CODEX_POSIX },
  antigravity: { win32: AGY_WINDOWS, darwin: AGY_POSIX, linux: AGY_POSIX }
}

const normalize = (path: string, windows: boolean): string =>
  windows ? path.replaceAll('/', '\\').toLowerCase() : path

async function shapeMatches(
  shape: StandaloneInstall['shape'],
  exec: HostExecutor,
  path: string
): Promise<boolean> {
  if (shape === 'windows') {
    return true
  }
  if (shape === 'file') {
    const plain = await exec.run(['test', '-f', path], PROOF_TIMEOUT_MS)
    const link = await exec.run(['test', '-L', path], PROOF_TIMEOUT_MS)
    return plain.code === 0 && link.code !== 0
  }
  const target = await exec.run(['readlink', path], PROOF_TIMEOUT_MS)
  return target.code === 0 && shape.link.test(target.stdout.trim())
}

/**
 * Proves the found binary is the one the vendor installer left, by exact path and shape.
 * Anything else, including a missing host fact, returns null and stays unsupported.
 */
export async function proveStandalone(
  program: MarketplaceHostProgramId,
  exec: HostExecutor,
  facts: HostFacts,
  binaryPath: string
): Promise<StandaloneProof | null> {
  const install = STANDALONE[program]?.[facts.platform]
  const expected = install?.binary(facts)
  const windows = facts.platform === 'win32'
  if (!install || !expected || normalize(binaryPath, windows) !== normalize(expected, windows)) {
    return null
  }
  if (!(await shapeMatches(install.shape, exec, binaryPath))) {
    return null
  }
  return {
    script: install.script,
    display: install.script,
    removed: install.removed(facts),
    note: install.note
  }
}
