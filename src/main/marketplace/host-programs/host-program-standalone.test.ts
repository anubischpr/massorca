import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { reinstallHostProgram } from './host-program-reinstall'
import { hostProgramStatus, uninstallHostProgram } from './host-program-service'
import { fakeHost, type FakeHost } from './host-program-test-host'

const LOCAL = 'C:\\Users\\u\\AppData\\Local'
const PROFILE = 'C:\\Users\\u'
const CODEX_WIN = `${LOCAL}\\Programs\\OpenAI\\Codex\\bin\\codex.exe`
const AGY_WIN = `${LOCAL}\\agy\\bin\\agy.EXE`
const CLAUDE_WIN = `${PROFILE}\\.local\\bin\\claude.exe`
const CODEX_LINK = '/home/u/.codex/packages/standalone/current/bin/codex'
const CLAUDE_LINK = '/home/u/.local/share/claude/versions/2.1.0'

// Scripts are matched by what they remove, so a test never repeats a whole script.
const CODEX_WIN_RM = /Programs\\OpenAI\\Codex/
const CODEX_POSIX_RM = /codex-code-mode-host/
const AGY_WIN_RM = /'agy'/
const AGY_POSIX_RM = /rm -f "\$HOME\/\.local\/bin\/agy"/
const CLAUDE_POSIX_RM = /rm -rf "\$HOME\/\.local\/share\/claude"/
const CLAUDE_WIN_RM = /USERPROFILE.*claude\.exe/
const CLAUDE_WIN_LAYOUT = /Test-Path.*USERPROFILE.*share/

function scripted(calls: string[]): string[] {
  return calls.filter((call) => call.startsWith('script:')).map((call) => call.slice(7))
}

function removalScript(host: FakeHost, match: RegExp): string | undefined {
  return scripted(host.calls).find((text) => match.test(text))
}

function removedNothing(host: FakeHost): boolean {
  return !scripted(host.calls).some((text) => /Delete\(|\brm\b|Remove-Item/.test(text))
}

describe('uninstall of a standalone Codex', () => {
  it('removes the vendor Codex folder on Windows, by exact path, and says which', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { codex: CODEX_WIN },
      scripts: [{ match: CODEX_WIN_RM, effect: (h) => h.present.delete('codex') }]
    })
    const result = await uninstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(`${LOCAL}\\Programs\\OpenAI\\Codex`)
  })

  it('unlinks every junction before the recursive delete, never following one into ~/.codex', async () => {
    const host = fakeHost({ platform: 'win32', present: { codex: CODEX_WIN } })
    await uninstallHostProgram('codex', host)
    const script = removalScript(host, CODEX_WIN_RM) ?? ''
    expect(script).toContain('ReparsePoint')
    expect(script).toMatch(/Directory\]::Delete\(\$c\.FullName\)/)
    expect(script.indexOf('ReparsePoint')).toBeLessThan(script.indexOf('Delete($root, $true)'))
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
      expect(removedNothing(host)).toBe(true)
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
      answers: { 'readlink /home/u/.local/bin/codex': { code: 0, stdout: `${CODEX_LINK}\n` } },
      scripts: [{ match: CODEX_POSIX_RM, effect: (h) => h.present.delete('codex') }]
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
    const regularFile = fakeHost({
      platform: 'linux',
      present: { codex: '/home/u/.local/bin/codex' }
    })
    const elsewhere = fakeHost({
      platform: 'linux',
      present: { codex: '/opt/codex/bin/codex' },
      answers: { 'readlink /opt/codex/bin/codex': { code: 0, stdout: `${CODEX_LINK}\n` } }
    })
    for (const host of [wrongTarget, regularFile, elsewhere]) {
      await expect(uninstallHostProgram('codex', host)).resolves.toMatchObject({
        reason: 'unsupported'
      })
      expect(removedNothing(host)).toBe(true)
    }
  })
})

describe('uninstall of a standalone Antigravity', () => {
  it('unlinks junctions in agy\\bin first, and removes the agy folder only when nothing else is in it', async () => {
    const host = fakeHost({ platform: 'win32', present: { agy: AGY_WIN } })
    await uninstallHostProgram('antigravity', host)
    const script = removalScript(host, AGY_WIN_RM) ?? ''
    expect(script).toContain("'bin'")
    expect(script).toContain('ReparsePoint')
    expect(script).toMatch(/Directory\]::Delete\(\$c\.FullName\)/)
    expect(script.indexOf('ReparsePoint')).toBeLessThan(script.indexOf('Delete($bin, $true)'))
    expect(script).toMatch(/Get-ChildItem/)
  })

  it('reports the removed path once the program is gone', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { agy: AGY_WIN },
      scripts: [{ match: AGY_WIN_RM, effect: (h) => h.present.delete('agy') }]
    })
    const result = await uninstallHostProgram('antigravity', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(`${LOCAL}\\agy\\bin`)
  })

  it('removes the one file the installer script copies on Linux and macOS', async () => {
    const host = fakeHost({
      platform: 'darwin',
      present: { agy: '/home/u/.local/bin/agy' },
      answers: { 'test -f /home/u/.local/bin/agy': { code: 0 } },
      scripts: [{ match: AGY_POSIX_RM, effect: (h) => h.present.delete('agy') }]
    })
    const result = await uninstallHostProgram('antigravity', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain('/home/u/.local/bin/agy')
  })

  it('does not remove a symlink or a binary outside the installer target', async () => {
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
      expect(removedNothing(host)).toBe(true)
    }
  })
})

describe('uninstall of a native Claude Code', () => {
  it('removes the launcher and version folder only when the launcher points into the vendor layout', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { claude: '/home/u/.local/bin/claude' },
      answers: {
        'readlink /home/u/.local/bin/claude': { code: 0, stdout: `${CLAUDE_LINK}\n` }
      },
      scripts: [{ match: CLAUDE_POSIX_RM, effect: (h) => h.present.delete('claude') }]
    })
    const result = await uninstallHostProgram('claude', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain('/home/u/.local/bin/claude')
    expect(scripted(host.calls).join('\n')).not.toMatch(/\.claude(?!\/)|\.claude\.json/)
  })

  it('never deletes a wrapper script or a link that points elsewhere', async () => {
    const wrapper = fakeHost({
      platform: 'linux',
      present: { claude: '/home/u/.local/bin/claude' }
    })
    const elsewhere = fakeHost({
      platform: 'linux',
      present: { claude: '/home/u/.local/bin/claude' },
      answers: {
        'readlink /home/u/.local/bin/claude': { code: 0, stdout: '/opt/claude/bin/claude\n' }
      }
    })
    const prefixTrick = fakeHost({
      platform: 'linux',
      present: { claude: '/home/u/.local/bin/claude' },
      answers: {
        'readlink /home/u/.local/bin/claude': {
          code: 0,
          stdout: '/home/u/.local/share/claude-other/bin/claude\n'
        }
      }
    })
    for (const host of [wrapper, elsewhere, prefixTrick]) {
      await expect(uninstallHostProgram('claude', host)).resolves.toMatchObject({
        ok: false,
        reason: 'unsupported'
      })
      expect(removedNothing(host)).toBe(true)
    }
  })

  it('removes the Windows launcher only at the exact vendor path with the version folder beside it', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { claude: CLAUDE_WIN },
      scripts: [
        { match: CLAUDE_WIN_LAYOUT },
        { match: CLAUDE_WIN_RM, effect: (h) => h.present.delete('claude') }
      ]
    })
    const result = await uninstallHostProgram('claude', host)
    expect(result).toMatchObject({ ok: true })
    const script = removalScript(host, CLAUDE_WIN_RM) ?? ''
    expect(script).toContain('ReparsePoint')
    expect(script).not.toMatch(/\.claude(?!\.)/)
  })

  it('keeps Windows copies unsupported when the layout is missing or the path differs', async () => {
    const noLayout = fakeHost({
      platform: 'win32',
      present: { claude: CLAUDE_WIN },
      scripts: [{ match: CLAUDE_WIN_LAYOUT, result: { code: 1 } }]
    })
    const elsewhere = fakeHost({
      platform: 'win32',
      present: { claude: 'D:\\tools\\.local\\bin\\claude.exe' },
      scripts: [{ match: CLAUDE_WIN_LAYOUT }]
    })
    for (const host of [noLayout, elsewhere]) {
      await expect(uninstallHostProgram('claude', host)).resolves.toMatchObject({
        reason: 'unsupported'
      })
      expect(scripted(host.calls).some((text) => CLAUDE_WIN_RM.test(text))).toBe(false)
    }
  })
})

describe.runIf(process.platform === 'win32')(
  'the Windows removal scripts on a real scratch folder',
  () => {
    function runInScratch(script: string, localAppData: string): void {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        env: { ...process.env, LOCALAPPDATA: localAppData, USERPROFILE: localAppData }
      })
    }

    it('unlinks the junction and leaves the folder it pointed at untouched', async () => {
      const scratch = mkdtempSync(join(tmpdir(), 'orca-t6-'))
      try {
        const kept = join(scratch, 'kept-data')
        mkdirSync(kept)
        writeFileSync(join(kept, 'config.toml'), 'user data')
        const root = join(scratch, 'Programs', 'OpenAI', 'Codex')
        mkdirSync(root, { recursive: true })
        writeFileSync(join(root, 'readme.txt'), 'x')
        symlinkSync(kept, join(root, 'bin'), 'junction')
        const host = fakeHost({ platform: 'win32', present: { codex: CODEX_WIN } })
        await uninstallHostProgram('codex', host)
        runInScratch(removalScript(host, CODEX_WIN_RM) ?? '', scratch)
        expect(existsSync(root)).toBe(false)
        expect(existsSync(join(kept, 'config.toml'))).toBe(true)
      } finally {
        rmSync(scratch, { recursive: true, force: true })
      }
    })

    it('does the same for the Antigravity bin folder and keeps other files in agy', async () => {
      const scratch = mkdtempSync(join(tmpdir(), 'orca-t6-'))
      try {
        const kept = join(scratch, 'kept-data')
        mkdirSync(kept)
        writeFileSync(join(kept, 'settings.json'), 'user data')
        const agy = join(scratch, 'agy')
        mkdirSync(agy)
        writeFileSync(join(agy, 'other.txt'), 'x')
        symlinkSync(kept, join(agy, 'bin'), 'junction')
        const host = fakeHost({ platform: 'win32', present: { agy: AGY_WIN } })
        await uninstallHostProgram('antigravity', host)
        runInScratch(removalScript(host, AGY_WIN_RM) ?? '', scratch)
        expect(existsSync(join(agy, 'bin'))).toBe(false)
        expect(existsSync(join(agy, 'other.txt'))).toBe(true)
        expect(existsSync(join(kept, 'settings.json'))).toBe(true)
      } finally {
        rmSync(scratch, { recursive: true, force: true })
      }
    })
  }
)

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

const NPM_INSTALL = 'npm install -g @openai/codex'
const NPM_COPY = 'C:\\Users\\u\\AppData\\Roaming\\npm\\codex.cmd'

function codexReinstallHost(options: {
  afterInstall?: (h: FakeHost) => void
  installCode?: number
}): FakeHost {
  return fakeHost({
    platform: 'win32',
    present: { codex: CODEX_WIN, npm: 'C:\\npm.cmd' },
    answers: { [NPM_INSTALL]: { code: options.installCode ?? 0, stderr: 'npm ERR! offline' } },
    effects: options.afterInstall ? { [NPM_INSTALL]: options.afterInstall } : {},
    scripts: [{ match: CODEX_WIN_RM }]
  })
}

describe('reinstall', () => {
  it('installs the managed copy first, proves it resolves elsewhere, then removes only the proven folder', async () => {
    const host = codexReinstallHost({ afterInstall: (h) => h.present.set('codex', NPM_COPY) })
    const result = await reinstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(`${LOCAL}\\Programs\\OpenAI\\Codex`)
    const order = host.calls.filter(
      (call) => call === NPM_INSTALL || (call.startsWith('script:') && CODEX_WIN_RM.test(call))
    )
    expect(order).toHaveLength(2)
    expect(order[0]).toBe(NPM_INSTALL)
  })

  it('keeps the old copy when the new binary does not resolve on the PATH', async () => {
    const host = codexReinstallHost({ afterInstall: (h) => h.present.delete('codex') })
    await expect(reinstallHostProgram('codex', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed'
    })
    expect(removedNothing(host)).toBe(true)
  })

  it('keeps the old copy when the PATH still resolves to it, and says so', async () => {
    const host = codexReinstallHost({})
    const result = await reinstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain(CODEX_WIN)
    expect(result.ok && result.message).toContain('left in place')
    expect(removedNothing(host)).toBe(true)
  })

  it('keeps the old copy when the new binary does not run', async () => {
    const host = codexReinstallHost({ afterInstall: (h) => h.present.set('codex', NPM_COPY) })
    host.run = async (argv) => {
      host.calls.push(argv.join(' '))
      const broken = argv.join(' ') === 'codex --version' && host.present.get('codex') === NPM_COPY
      return {
        code: broken ? 1 : 0,
        stdout: broken ? '' : 'codex 1.0\n',
        stderr: '',
        timedOut: false
      }
    }
    const result = await reinstallHostProgram('codex', host)
    expect(result.ok && result.message).toContain('left in place')
    expect(removedNothing(host)).toBe(true)
  })

  it('deletes nothing when the managed install fails', async () => {
    const host = codexReinstallHost({ installCode: 1 })
    await expect(reinstallHostProgram('codex', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'npm ERR! offline'
    })
    expect(removedNothing(host)).toBe(true)
  })

  it('installs beside an unproven copy and says the old one stays', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { codex: '/opt/codex/bin/codex', npm: '/usr/bin/npm' },
      answers: { [NPM_INSTALL]: { code: 0 } }
    })
    const result = await reinstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.message).toContain('/opt/codex/bin/codex')
    expect(removedNothing(host)).toBe(true)
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
      answers: { [NPM_INSTALL]: { code: 0 } },
      effects: { [NPM_INSTALL]: (h) => h.present.set('codex', '/usr/bin/codex') }
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
    expect(removedNothing(host)).toBe(true)
  })
})
