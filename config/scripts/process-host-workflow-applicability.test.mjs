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
const hooks = workflow.jobs.managed_hook_node18.steps.find(
  (candidate) => candidate.name === 'Smoke managed-hook companions'
)
const smoke = workflow.jobs.managed_hook_node18.steps.find(
  (candidate) => candidate.name === 'Smoke process-host package'
)
const crossing = workflow.jobs['cross-version-wire']
const releaseFetch = crossing.steps.find(
  (candidate) => candidate.name === 'Fetch supported upstream release fixtures'
)
const roots = []
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash'

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function runStep({
  run = step.run,
  packagePresent = false,
  manifestPresent = true,
  manifestExit = 0,
  checkerExit,
  managedHookExit = 0,
  releaseCommit = crossing.env.ORCA_CROSS_VERSION_BASELINE_REF,
  fetchExit = 0
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'orca-process-host-workflow-'))
  roots.push(root)
  const bin = path.join(root, 'bin')
  mkdirSync(bin)
  const calls = path.join(root, 'calls.txt')
  writeFileSync(calls, '')
  const program = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALLS_FILE"
case "$*" in
  'run check:reliability-gates') exit "$MANIFEST_EXIT" ;;
  'run check:process-host-imports') exit "$CHECKER_EXIT" ;;
  'config/scripts/smoke-managed-hook-runtime-node18.mjs') exit "$MANAGED_HOOK_EXIT" ;;
  'config/scripts/smoke-process-host-node18.mjs') exit "$CHECKER_EXIT" ;;
  'rev-parse v1.4.223^{commit}') printf '%s' "$RELEASE_COMMIT"; exit 0 ;;
  '-c credential.helper= fetch '*) exit "$FETCH_EXIT" ;;
  *) exit 99 ;;
esac
`
  for (const command of ['pnpm', 'node', 'git']) {
    const shim = path.join(bin, command)
    writeFileSync(shim, program)
    chmodSync(shim, 0o755)
  }
  if (packagePresent) {
    const directory = path.join(root, 'src/packages/process-host')
    mkdirSync(directory, { recursive: true })
    if (manifestPresent) {
      writeFileSync(path.join(directory, 'package.json'), '{}')
    }
  }
  const result = spawnSync(
    bash,
    ['--noprofile', '--norc', '-e', '-c', `export PATH="$FIXTURE_BIN:$PATH"\n${run}`],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        FIXTURE_BIN: bin
          .replaceAll('\\', '/')
          .replace(/^([a-z]):/i, (_, drive) => `/${drive.toLowerCase()}`),
        CALLS_FILE: calls.replaceAll('\\', '/'),
        MANIFEST_EXIT: String(manifestExit),
        CHECKER_EXIT: String(checkerExit ?? 127),
        MANAGED_HOOK_EXIT: String(managedHookExit),
        ORCA_CROSS_VERSION_BASELINE_REF: crossing.env.ORCA_CROSS_VERSION_BASELINE_REF,
        RELEASE_COMMIT: releaseCommit,
        FETCH_EXIT: String(fetchExit)
      }
    }
  )
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
    expect(result.status, result.stderr).toBe(0)
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

describe('Node18 process-host smoke applicability', () => {
  const run = `${hooks.run}\n${smoke.run}`

  it.each([false, true])(
    'always executes managed hooks with package present=%s',
    (packagePresent) => {
      const result = runStep({ run, packagePresent, checkerExit: 0 })
      expect(result.status).toBe(0)
      expect(result.calls[0]).toBe('config/scripts/smoke-managed-hook-runtime-node18.mjs')
      expect(result.calls.includes('config/scripts/smoke-process-host-node18.mjs')).toBe(
        packagePresent
      )
    }
  )

  it.each([false, true])(
    'retains managed-hook failure with package present=%s',
    (packagePresent) => {
      expect(runStep({ run, packagePresent, managedHookExit: 23 }).status).toBe(23)
    }
  )

  it.each([false, true])('rejects a missing smoke with manifest present=%s', (manifestPresent) => {
    expect(runStep({ run, packagePresent: true, manifestPresent }).status).toBe(127)
  })

  it('propagates a present package smoke failure', () => {
    expect(runStep({ run, packagePresent: true, checkerExit: 41 }).status).toBe(41)
  })
})

describe('fork cross-version release inputs', () => {
  it('pins the published older upstream release and retains both semantic check commands', () => {
    expect(crossing.env.ORCA_CROSS_VERSION_BASELINE_REF).toBe(
      '5272afeda68c2fe2bbdc3f09159c66688dc27328'
    )
    expect(
      crossing.steps.some(
        (candidate) => candidate.run === 'pnpm run check:daemon-protocol-crossing'
      )
    ).toBe(true)
    expect(
      crossing.steps.some((candidate) => candidate.run?.includes('tests/e2e/cross-version-wire/'))
    ).toBe(true)
    expect(releaseFetch.run).toContain(
      '--no-tags --filter=blob:none https://github.com/stablyai/orca.git'
    )
    expect(releaseFetch.run).not.toContain('--tags')
    expect(releaseFetch.run).not.toContain('refs/tags/*')
  })

  it('fetches the finite historical fixture tag set and verifies its baseline identity', () => {
    const result = runStep({ run: releaseFetch.run })
    expect(result.status).toBe(0)
    expect(result.calls).toHaveLength(2)
    expect(result.calls[0].match(/refs\/tags\/v1\.4\.\d+:refs\/tags\/v1\.4\.\d+/g)).toHaveLength(13)
    expect(result.calls[1]).toBe('rev-parse v1.4.223^{commit}')
  })

  it('refuses a moved tag instead of silently comparing a different release', () => {
    expect(
      runStep({ run: releaseFetch.run, releaseCommit: '2bb20586ebc39d605e16d95f57420e20a16e7485' })
        .status
    ).not.toBe(0)
  })

  it('retains upstream fetch failures', () => {
    expect(runStep({ run: releaseFetch.run, fetchExit: 19 }).status).toBe(19)
  })
})
