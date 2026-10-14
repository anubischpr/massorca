import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workflow = parse(readFileSync('.github/workflows/pr.yml', 'utf8'))
const step = workflow.jobs.preflight.steps.find(
  (candidate) => candidate.name === 'Check reliability gate manifest'
)
const roots = []
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash'

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function runStep({
  packagePresent = false,
  manifestPresent = true,
  manifestExit = 0,
  checkerExit
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'orca-process-host-workflow-'))
  roots.push(root)
  const bin = path.join(root, 'bin')
  mkdirSync(bin)
  const calls = path.join(root, 'calls.txt')
  writeFileSync(calls, '')
  const shim = path.join(bin, 'pnpm')
  writeFileSync(
    shim,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALLS_FILE"
case "$*" in
  'run check:reliability-gates') exit "$MANIFEST_EXIT" ;;
  'run check:process-host-imports') exit "$CHECKER_EXIT" ;;
  *) exit 99 ;;
esac
`
  )
  chmodSync(shim, 0o755)
  if (packagePresent) {
    const directory = path.join(root, 'src/packages/process-host')
    mkdirSync(directory, { recursive: true })
    if (manifestPresent) {
      writeFileSync(path.join(directory, 'package.json'), '{}')
    }
  }
  const result = spawnSync(bash, ['--noprofile', '--norc', '-e', '-c', step.run], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      CALLS_FILE: calls.replaceAll('\\', '/'),
      MANIFEST_EXIT: String(manifestExit),
      CHECKER_EXIT: String(checkerExit ?? 127)
    }
  })
  if (result.error) {
    throw result.error
  }
  return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n') }
}

describe('baseline process-host workflow applicability', () => {
  it('retains the selected static-analysis condition and unconditional manifest check', () => {
    expect(step.if).toBe("needs.code_paths.outputs.static_analysis == 'true'")
    expect(step.run.split('\n')[0]).toBe('pnpm run check:reliability-gates')
  })

  it('reports the import check inapplicable only when the package is absent', () => {
    const result = runStep()
    expect(result.status).toBe(0)
    expect(result.calls).toEqual(['run check:reliability-gates'])
    expect(result.stdout).toContain('not applicable: this baseline has no process-host package')
  })

  it('executes both checks when the package and checker exist', () => {
    const result = runStep({ packagePresent: true, checkerExit: 0 })
    expect(result.status).toBe(0)
    expect(result.calls).toEqual(['run check:reliability-gates', 'run check:process-host-imports'])
    expect(result.stdout).not.toContain('not applicable')
  })

  it('fails when the package exists but its checker script is missing', () => {
    const result = runStep({ packagePresent: true })
    expect(result.status).toBe(127)
    expect(result.calls).toContain('run check:process-host-imports')
  })

  it('does not exempt a partial package whose manifest is missing', () => {
    const result = runStep({ packagePresent: true, manifestPresent: false })
    expect(result.status).toBe(127)
    expect(result.calls).toContain('run check:process-host-imports')
  })

  it('propagates checker failures without converting them to inapplicability', () => {
    expect(runStep({ packagePresent: true, checkerExit: 41 }).status).toBe(41)
  })

  it.each([false, true])(
    'preserves manifest failures with package present=%s',
    (packagePresent) => {
      const result = runStep({ packagePresent, manifestExit: 23, checkerExit: 0 })
      expect(result.status).toBe(23)
      expect(result.calls).toEqual(['run check:reliability-gates'])
    }
  )
})
