import { createInterface } from 'node:readline'
import { spawnProcess } from '../../../shared/child-process/run-process'
import { forceTerminateProcessTree } from '../../../shared/child-process/process-tree-termination'
import type { InstallStep, StepRunResult } from './git-install-types'

const MAX_LOG_LINE_LENGTH = 240
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')

/** Plain text for one output line: no escapes, no carriage-return spinner frames, no blank or spinner-only lines. */
export function sanitizeLogLine(raw: string): string | null {
  const frames = raw
    .replace(ANSI_ESCAPE, '')
    .split('\r')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  const lastFrame = frames.at(-1)
  if (!lastFrame || /^[-\\|/\s]+$/.test(lastFrame)) {
    return null
  }
  return lastFrame.length > MAX_LOG_LINE_LENGTH
    ? `${lastFrame.slice(0, MAX_LOG_LINE_LENGTH - 1)}…`
    : lastFrame
}

/**
 * Runs one install step and streams its output lines as they arrive.
 * Why spawnProcess and not runProcess: runProcess returns output only at exit, and the board promises live log lines.
 */
export function streamInstallStep(
  step: InstallStep,
  options: { env?: NodeJS.ProcessEnv; timeoutMs: number; onLine: (line: string) => void }
): Promise<StepRunResult> {
  return new Promise<StepRunResult>((resolve, reject) => {
    const [program = '', ...args] = step.argv
    const child = spawnProcess({ program, args, env: options.env })
    let timedOut = false
    let settled = false
    const timer = setTimeout(() => {
      timedOut = true
      void forceTerminateProcessTree(child)
    }, options.timeoutMs)
    const settle = (act: () => void): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      act()
    }
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8')
      createInterface({ input: stream }).on('line', (line) => {
        const clean = sanitizeLogLine(line)
        if (clean !== null) {
          options.onLine(clean)
        }
      })
    }
    // Why: the installers run unattended; a prompt must read end-of-input instead of hanging the step.
    child.stdin.on('error', () => {})
    child.stdin.end()
    child.once('error', (error) => settle(() => reject(error)))
    child.once('close', (code) => settle(() => resolve({ code, timedOut })))
  })
}
