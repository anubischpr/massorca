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
  /** The exact command path the vendor installer leaves; null when the host did not report the folder it lives under. */
  binary: (facts: HostFacts) => string | null
  /**
   * How the command must look: a Windows path alone, a Windows layout probe that must pass, a POSIX
   * symlink whose target this accepts, or a plain POSIX file the installer copied.
   */
  shape:
    | 'windows'
    | 'file'
    | { windowsProbe: string }
    | { link: (facts: HostFacts, target: string) => boolean }
  script: string
  removed: (facts: HostFacts) => string
  note: string
}

// Why unlink first: on Windows PowerShell 5.1 a recursive Directory.Delete throws on a junction child
// (Codex's bin is a junction into ~/.codex) and leaves a half-removed folder. Unlinking each reparse
// point with a non-recursive delete never follows it, so what it points at is untouched.
const UNLINK_REPARSE_POINTS =
  "$ErrorActionPreference = 'Stop'; function Unlink($c) { if ($c.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { if ($c.PSIsContainer) { [System.IO.Directory]::Delete($c.FullName) } else { [System.IO.File]::Delete($c.FullName) } } elseif ($c.PSIsContainer) { foreach ($k in Get-ChildItem -LiteralPath $c.FullName -Force) { Unlink $k } } }"

const CODEX_WINDOWS: StandaloneInstall = {
  binary: (facts) =>
    facts.localAppData ? `${facts.localAppData}\\Programs\\OpenAI\\Codex\\bin\\codex.exe` : null,
  shape: 'windows',
  script: `${UNLINK_REPARSE_POINTS}; $root = Join-Path $env:LOCALAPPDATA 'Programs\\OpenAI\\Codex'; Unlink (Get-Item -LiteralPath $root -Force); if (Test-Path -LiteralPath $root) { [System.IO.Directory]::Delete($root, $true) }`,
  removed: (facts) => `${facts.localAppData}\\Programs\\OpenAI\\Codex`,
  note: 'Your ~\\.codex folder was not touched.'
}

const CODEX_POSIX: StandaloneInstall = {
  binary: (facts) => (facts.home ? `${facts.home}/.local/bin/codex` : null),
  // Why: the installer symlinks the command to the release it unpacked under ~/.codex/packages/standalone.
  shape: {
    link: (_facts, target) => /(?:^|\/)packages\/standalone\/current\/(?:bin\/)?codex$/.test(target)
  },
  script:
    'for f in "$HOME/.local/bin/codex" "$HOME/.local/bin/codex-code-mode-host"; do if [ -L "$f" ]; then rm -f "$f"; fi; done',
  removed: (facts) => `${facts.home}/.local/bin/codex`,
  note: 'The unpacked release stays under ~/.codex/packages/standalone, which MassOrca never touches.'
}

const AGY_WINDOWS: StandaloneInstall = {
  binary: (facts) => (facts.localAppData ? `${facts.localAppData}\\agy\\bin\\agy.exe` : null),
  shape: 'windows',
  // Why: only bin is the installer's; the agy folder goes too only when nothing else lives in it.
  script: `${UNLINK_REPARSE_POINTS}; $root = Join-Path $env:LOCALAPPDATA 'agy'; $bin = Join-Path $root 'bin'; if (Test-Path -LiteralPath $bin) { Unlink (Get-Item -LiteralPath $bin -Force); if (Test-Path -LiteralPath $bin) { [System.IO.Directory]::Delete($bin, $true) } }; if ((Test-Path -LiteralPath $root) -and -not (Get-ChildItem -LiteralPath $root -Force)) { [System.IO.Directory]::Delete($root) }`,
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

const CLAUDE_POSIX: StandaloneInstall = {
  binary: (facts) => (facts.home ? `${facts.home}/.local/bin/claude` : null),
  // Why: the vendor layout is a launcher symlinked into ~/.local/share/claude/versions/<v>; a wrapper
  // script or a link anywhere else is the person's own and stays.
  shape: {
    link: (facts, target) =>
      facts.home !== null &&
      target.startsWith(`${facts.home}/.local/share/claude/`) &&
      !target.split('/').includes('..')
  },
  script: 'rm -f "$HOME/.local/bin/claude" && rm -rf "$HOME/.local/share/claude"',
  removed: (facts) => `${facts.home}/.local/bin/claude and ${facts.home}/.local/share/claude`,
  note: 'Your ~/.claude settings and sessions were not touched.'
}

const CLAUDE_WINDOWS_LAYOUT_PROBE =
  "if (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.local\\share\\claude')) { exit 0 } else { exit 1 }"

const CLAUDE_WINDOWS: StandaloneInstall = {
  binary: (facts) => (facts.userProfile ? `${facts.userProfile}\\.local\\bin\\claude.exe` : null),
  // Why a probe: Windows has no link to read, so the vendor's version folder beside the launcher is the proof.
  shape: { windowsProbe: CLAUDE_WINDOWS_LAYOUT_PROBE },
  script: `${UNLINK_REPARSE_POINTS}; $exe = Join-Path $env:USERPROFILE '.local\\bin\\claude.exe'; $share = Join-Path $env:USERPROFILE '.local\\share\\claude'; if (Test-Path -LiteralPath $exe) { [System.IO.File]::Delete($exe) }; if (Test-Path -LiteralPath $share) { Unlink (Get-Item -LiteralPath $share -Force); if (Test-Path -LiteralPath $share) { [System.IO.Directory]::Delete($share, $true) } }`,
  removed: (facts) =>
    `${facts.userProfile}\\.local\\bin\\claude.exe and ${facts.userProfile}\\.local\\share\\claude`,
  note: 'Your ~\\.claude settings and sessions were not touched.'
}

// Why only these: each row is a default target read from the vendor's own installer or setup docs.
const STANDALONE: Partial<
  Record<MarketplaceHostProgramId, Partial<Record<HostPlatform, StandaloneInstall>>>
> = {
  codex: { win32: CODEX_WINDOWS, darwin: CODEX_POSIX, linux: CODEX_POSIX },
  antigravity: { win32: AGY_WINDOWS, darwin: AGY_POSIX, linux: AGY_POSIX },
  claude: { win32: CLAUDE_WINDOWS, darwin: CLAUDE_POSIX, linux: CLAUDE_POSIX }
}

const normalize = (path: string, windows: boolean): string =>
  windows ? path.replaceAll('/', '\\').toLowerCase() : path

async function shapeMatches(
  shape: StandaloneInstall['shape'],
  exec: HostExecutor,
  facts: HostFacts,
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
  if ('windowsProbe' in shape) {
    return (await exec.script(shape.windowsProbe, PROOF_TIMEOUT_MS)).code === 0
  }
  const target = await exec.run(['readlink', path], PROOF_TIMEOUT_MS)
  return target.code === 0 && shape.link(facts, target.stdout.trim())
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
  if (!(await shapeMatches(install.shape, exec, facts, binaryPath))) {
    return null
  }
  return {
    script: install.script,
    display: install.script,
    removed: install.removed(facts),
    note: install.note
  }
}
