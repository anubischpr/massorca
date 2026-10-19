import { runProcess } from '../../shared/child-process/run-process'
import { parseCliVersion } from '../../shared/app-version'
import type { AgentCliVersionProbeOutcome } from '../agent-cli-version-probe'

function parseGentleShellPiVersion(output: string): string | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const wrapperLine =
    /^gentle-shell(?:\s+version)?\s+(v?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)$/i
  const piLine = /^pi(?:\s+version)?\s+(v?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)$/i
  const hasValidLineCount =
    lines.length === 2 || (lines.length === 3 && /^home isolated \S.*$/i.test(lines[2]))
  if (!hasValidLineCount || !wrapperLine.test(lines[0]) || !piLine.test(lines[1])) {
    return null
  }
  return parseCliVersion(lines[1])
}

/** `gentle-shell --version` prints its own line, then the Pi release it wraps. */
export async function probeGentleShellPiOutcome(
  launch: { command: string; cwd: string; env: Record<string, string> },
  supportsPiVersion: (version: string) => boolean
): Promise<AgentCliVersionProbeOutcome> {
  let result
  try {
    result = await runProcess({
      program: launch.command,
      cwd: launch.cwd,
      env: launch.env,
      args: ['--version'],
      timeoutMs: 5_000,
      maxOutputBytes: 4_096,
      killOnOutputLimit: true
    })
  } catch {
    return 'did-not-start'
  }
  if (result.code !== 0 || result.timedOut || result.outputTruncated) {
    return 'unsupported'
  }
  const version = parseGentleShellPiVersion(result.stdout)
  return version !== null && supportsPiVersion(version) ? 'supported' : 'unsupported'
}
