import { describe, expect, it } from 'vitest'
import { reinstallHostProgram } from './host-program-reinstall'
import { hostProgramStatus, uninstallHostProgram } from './host-program-service'
import { fakeHost } from './host-program-test-host'

const LOCAL = 'C:\\Users\\u\\AppData\\Local'
const CODEX_WIN = `${LOCAL}\\Programs\\OpenAI\\Codex\\bin\\codex.exe`
const AGY_WIN = `${LOCAL}\\agy\\bin\\agy.EXE`
const CODEX_LINK = '/home/u/.codex/packages/standalone/current/bin/codex'

const CODEX_WIN_SCRIPT =
  "[System.IO.Directory]::Delete((Join-Path $env:LOCALAPPDATA 'Programs\\OpenAI\\Codex'), $true)"
const CODEX_POSIX_SCRIPT =
  'for f in "$HOME/.local/bin/codex" "$HOME/.local/bin/codex-code-mode-host"; do if [ -L "$f" ]; then rm -f "$f"; fi; done'
const AGY_POSIX_SCRIPT =
  'if [ -f "$HOME/.local/bin/agy" ] && [ ! -L "$HOME/.local/bin/agy" ]; then rm -f "$HOME/.local/bin/agy"; fi'

function scripted(calls: string[]): string[] {
  return calls.filter((call) => call.startsWith('script:')).map((call) => call.slice(7))
}

describe('uninstall of a standalone Codex', () => {
  it('removes the vendor Codex folder on Windows, by exact path, and says which', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { codex: CODEX_WIN },
      answers: { [`script:${CODEX_WIN_SCRIPT}`]: { code: 0 } },
      effects: { [`script:${CODEX_WIN_SCRIPT}`]: (h) => h.present.delete('codex') }
    })
    const result = await uninstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(`${LOCAL}\\Programs\\OpenAI\\Codex`)
    expect(scripted(host.calls)).toContain(CODEX_WIN_SCRIPT)
  })

  it('deletes through .NET so a junction into the data folder is unlinked, never followed', async () => {
    const host = fakeHost({ platform: 'win32', present: { codex: CODEX_WIN } })
    await uninstallHostProgram('codex', host)
    const script = scripted(host.calls).find((text) => text.includes('Directory]::Delete'))
    expect(script).toBeDefined()
    expect(script).not.toMatch(/Remove-Item/)
    expect(script).not.toContain('.codex')
  })

  it('leaves a Codex outside the vendor folder as unsupported and runs nothing', async () => {
    for (const path of [
      'D:\\tools\\codex\\codex.exe',
      `${LOCAL}\\Programs\\OpenAI\\Codex2\\bin\\codex.exe`
    ]) {
      const host = fakeHost({ platform: 'win32', present: { codex: path } })
      await expect(uninstallHostProgram('codex', host)).resolves.toMatchObject({
        ok: false,
        reason: 'unsupported'
      })
      expect(scripted(host.calls).some((text) => text.includes('Delete'))).toBe(false)
    }
  })

  it('is unsupported when the host did not say where its local app data is', async () => {
    const host = fakeHost({ platform: 'win32', present: { codex: CODEX_WIN }, localAppData: null })
    await expect(uninstallHostProgram('codex', host)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('removes only the command link on Linux when it points into the installer layout', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { codex: '/home/u/.local/bin/codex' },
      answers: {
        'readlink /home/u/.local/bin/codex': { code: 0, stdout: `${CODEX_LINK}\n` },
        [`script:${CODEX_POSIX_SCRIPT}`]: { code: 0 }
      },
      effects: { [`script:${CODEX_POSIX_SCRIPT}`]: (h) => h.present.delete('codex') }
    })
    const result = await uninstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain('/home/u/.local/bin/codex')
    expect(result.ok && result.message).toContain('~/.codex')
    expect(scripted(host.calls).join('\n')).not.toMatch(/\.codex\/|rm -rf/)
  })

  it('keeps Linux copies unsupported when the link points elsewhere or the file is real', async () => {
    const wrongTarget = fakeHost({
      platform: 'linux',
      present: { codex: '/home/u/.local/bin/codex' },
      answers: { 'readlink /home/u/.local/bin/codex': { code: 0, stdout: '/opt/other/codex\n' } }
    })
    await expect(uninstallHostProgram('codex', wrongTarget)).resolves.toMatchObject({
      reason: 'unsupported'
    })
    const regularFile = fakeHost({
      platform: 'linux',
      present: { codex: '/home/u/.local/bin/codex' }
    })
    await expect(uninstallHostProgram('codex', regularFile)).resolves.toMatchObject({
      reason: 'unsupported'
    })
    const elsewhere = fakeHost({
      platform: 'linux',
      present: { codex: '/opt/codex/bin/codex' },
      answers: { 'readlink /opt/codex/bin/codex': { code: 0, stdout: `${CODEX_LINK}\n` } }
    })
    await expect(uninstallHostProgram('codex', elsewhere)).resolves.toMatchObject({
      reason: 'unsupported'
    })
    for (const host of [wrongTarget, regularFile, elsewhere]) {
      expect(scripted(host.calls).some((text) => text.includes('rm '))).toBe(false)
    }
  })
})

describe('uninstall of a standalone Antigravity', () => {
  it('removes only the vendor bin folder on Windows and the agy folder when nothing else is in it', async () => {
    const host = fakeHost({ platform: 'win32', present: { agy: AGY_WIN } })
    await uninstallHostProgram('antigravity', host)
    const script = scripted(host.calls).find((text) => text.includes('Directory]::Delete'))
    expect(script).toContain("'agy'")
    expect(script).toContain('bin')
    expect(script).toMatch(/Get-ChildItem/)
  })

  it('reports the removed path once the program is gone', async () => {
    const host = fakeHost({ platform: 'win32', present: { agy: AGY_WIN } })
    host.script = async (text) => {
      host.calls.push(`script:${text}`)
      if (text.includes('Directory]::Delete')) {
        host.present.delete('agy')
        return { code: 0, stdout: '', stderr: '', timedOut: false }
      }
      return { code: 0, stdout: LOCAL, stderr: '', timedOut: false }
    }
    const result = await uninstallHostProgram('antigravity', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(`${LOCAL}\\agy\\bin`)
  })

  it('removes the one file the installer script copies on Linux and macOS', async () => {
    const host = fakeHost({
      platform: 'darwin',
      present: { agy: '/home/u/.local/bin/agy' },
      answers: {
        'test -f /home/u/.local/bin/agy': { code: 0 },
        [`script:${AGY_POSIX_SCRIPT}`]: { code: 0 }
      },
      effects: { [`script:${AGY_POSIX_SCRIPT}`]: (h) => h.present.delete('agy') }
    })
    const result = await uninstallHostProgram('antigravity', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain('/home/u/.local/bin/agy')
  })

  it('does not remove a symlink, a missing file or a binary outside the installer target', async () => {
    const link = fakeHost({
      platform: 'linux',
      present: { agy: '/home/u/.local/bin/agy' },
      answers: {
        'test -f /home/u/.local/bin/agy': { code: 0 },
        'test -L /home/u/.local/bin/agy': { code: 0 }
      }
    })
    const outside = fakeHost({
      platform: 'linux',
      present: { agy: '/opt/agy/agy' },
      answers: { 'test -f /opt/agy/agy': { code: 0 } }
    })
    for (const host of [link, outside]) {
      await expect(uninstallHostProgram('antigravity', host)).resolves.toMatchObject({
        reason: 'unsupported'
      })
      expect(scripted(host.calls).some((text) => text.includes('rm '))).toBe(false)
    }
  })
})

describe('status of a standalone install', () => {
  it('offers Uninstall once the path is proven and still offers Reinstall', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { codex: CODEX_WIN, npm: 'C:\\npm.cmd' }
    })
    await expect(hostProgramStatus('codex', host)).resolves.toMatchObject({
      installed: true,
      method: 'script',
      canUninstall: true,
      canReinstall: true,
      reinstallCommand: 'npm install -g @openai/codex'
    })
  })

  it('offers only Reinstall for an install it cannot prove, and never for one a package manager owns', async () => {
    const unknown = fakeHost({
      platform: 'linux',
      present: { codex: '/opt/codex/bin/codex', npm: '/usr/bin/npm' }
    })
    await expect(hostProgramStatus('codex', unknown)).resolves.toMatchObject({
      canUninstall: false,
      canReinstall: true
    })
    const owned = fakeHost({
      platform: 'linux',
      present: { codex: '/usr/bin/codex', npm: '/usr/bin/npm' },
      answers: { 'npm ls -g --depth=0 @openai/codex': { code: 0, stdout: '@openai/codex@1' } }
    })
    const status = await hostProgramStatus('codex', owned)
    expect(status).toMatchObject({ canUninstall: true })
    expect(status.ok && status.canReinstall).toBeFalsy()
  })

  it('offers no Reinstall when the host has no managed install to move to', async () => {
    const host = fakeHost({ platform: 'linux', present: { codex: '/opt/codex/bin/codex' } })
    const status = await hostProgramStatus('codex', host)
    expect(status.ok && status.canReinstall).toBeFalsy()
  })
})

describe('reinstall', () => {
  it('installs the managed copy first, then removes only the proven standalone folder', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { codex: CODEX_WIN, npm: 'C:\\npm.cmd' },
      answers: {
        'npm install -g @openai/codex': { code: 0 },
        [`script:${CODEX_WIN_SCRIPT}`]: { code: 0 }
      },
      effects: {
        [`script:${CODEX_WIN_SCRIPT}`]: (h) => h.present.set('codex', 'C:\\npm\\codex.cmd')
      }
    })
    const result = await reinstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(`${LOCAL}\\Programs\\OpenAI\\Codex`)
    const order = host.calls.filter(
      (call) => call === 'npm install -g @openai/codex' || call === `script:${CODEX_WIN_SCRIPT}`
    )
    expect(order).toEqual(['npm install -g @openai/codex', `script:${CODEX_WIN_SCRIPT}`])
  })

  it('deletes nothing when the managed install fails', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { codex: CODEX_WIN, npm: 'C:\\npm.cmd' },
      answers: { 'npm install -g @openai/codex': { code: 1, stderr: 'npm ERR! offline' } }
    })
    await expect(reinstallHostProgram('codex', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'npm ERR! offline'
    })
    expect(scripted(host.calls).some((text) => text.includes('Delete'))).toBe(false)
  })

  it('installs beside an unproven copy and says the old one stays', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { codex: '/opt/codex/bin/codex', npm: '/usr/bin/npm' },
      answers: { 'npm install -g @openai/codex': { code: 0 } }
    })
    const result = await reinstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain('/opt/codex/bin/codex')
    expect(scripted(host.calls).some((text) => text.includes('rm '))).toBe(false)
  })

  it('refuses an install a package manager already owns, and installs when nothing is there', async () => {
    const owned = fakeHost({
      platform: 'linux',
      present: { codex: '/usr/bin/codex', npm: '/usr/bin/npm' },
      answers: { 'npm ls -g --depth=0 @openai/codex': { code: 0, stdout: '@openai/codex@1' } }
    })
    await expect(reinstallHostProgram('codex', owned)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
    const absent = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm' },
      answers: { 'npm install -g @openai/codex': { code: 0 } },
      effects: { 'npm install -g @openai/codex': (h) => h.present.set('codex', '/usr/bin/codex') }
    })
    await expect(reinstallHostProgram('codex', absent)).resolves.toMatchObject({ ok: true })
  })

  it('re-runs the vendor script for Antigravity and deletes nothing', async () => {
    const script = 'curl -fsSL https://antigravity.google/cli/install.sh | bash'
    const host = fakeHost({
      platform: 'linux',
      present: { agy: '/home/u/.local/bin/agy', curl: '/usr/bin/curl', bash: '/bin/bash' },
      answers: { 'test -f /home/u/.local/bin/agy': { code: 0 }, [`script:${script}`]: { code: 0 } }
    })
    await expect(reinstallHostProgram('antigravity', host)).resolves.toMatchObject({ ok: true })
    expect(scripted(host.calls).some((text) => text.includes('rm '))).toBe(false)
  })
})
