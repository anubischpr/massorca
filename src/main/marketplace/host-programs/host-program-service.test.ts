import { describe, expect, it } from 'vitest'
import {
  failureMessage,
  hostProgramStatus,
  installHostProgram,
  uninstallHostProgram
} from './host-program-service'
import { fakeHost } from './host-program-test-host'

const WINGET_CLAUDE_INSTALL =
  'winget install --id Anthropic.ClaudeCode -e --source winget --silent --accept-source-agreements --accept-package-agreements'
const WINGET_CLAUDE_LIST = 'winget list --id Anthropic.ClaudeCode -e --accept-source-agreements'
const WINGET_CLAUDE_REMOVE =
  'winget uninstall --id Anthropic.ClaudeCode -e --silent --accept-source-agreements'

describe('install', () => {
  it('installs Claude Code with winget on Windows and reports the version it finds', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { winget: 'C:\\winget.exe' },
      answers: { [WINGET_CLAUDE_INSTALL]: { code: 0 } },
      effects: { [WINGET_CLAUDE_INSTALL]: (h) => h.present.set('claude', 'C:\\claude.exe') }
    })
    await expect(installHostProgram('claude', host)).resolves.toEqual({
      ok: true,
      version: 'claude 1.2.3'
    })
    expect(host.calls).toContain(WINGET_CLAUDE_INSTALL)
  })

  it('does nothing when the program is already on the host', async () => {
    const host = fakeHost({ platform: 'linux', present: { git: '/usr/bin/git' } })
    await expect(installHostProgram('git', host)).resolves.toEqual({
      ok: true,
      version: 'git 1.2.3'
    })
    expect(host.calls.some((call) => call.includes('install'))).toBe(false)
  })

  it('reports needs-admin with the exact command when sudo would ask for a password', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { 'apt-get': '/usr/bin/apt-get', sudo: '/usr/bin/sudo' },
      answers: { 'sudo -n true': { code: 1, stderr: 'sudo: a password is required' } }
    })
    await expect(installHostProgram('git', host)).resolves.toMatchObject({
      ok: false,
      reason: 'needs-admin',
      command: 'sudo apt-get install -y git'
    })
    expect(host.calls).not.toContain('sudo -n apt-get install -y git')
  })

  it('runs the package manager without sudo as root', async () => {
    const host = fakeHost({
      platform: 'linux',
      uid: '0',
      present: { 'apt-get': '/usr/bin/apt-get' },
      answers: { 'apt-get install -y git': { code: 0 } },
      effects: { 'apt-get install -y git': (h) => h.present.set('git', '/usr/bin/git') }
    })
    await expect(installHostProgram('git', host)).resolves.toMatchObject({ ok: true })
    expect(host.calls.some((call) => call.startsWith('sudo'))).toBe(false)
  })

  it('reports failed with the last line the installer printed', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm' },
      answers: {
        'npm install -g @openai/codex': {
          code: 1,
          stderr: 'npm ERR! first\nnpm ERR! EACCES permission denied\n'
        }
      }
    })
    await expect(installHostProgram('codex', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'npm ERR! EACCES permission denied',
      command: 'npm install -g @openai/codex'
    })
  })

  it('reports failed when the installer ran but the program is still not on the PATH', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm' },
      answers: { 'npm install -g gentle-pi': { code: 0 } }
    })
    await expect(installHostProgram('gentle-shell', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed'
    })
  })

  it('reports a timed out step as failed', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm' },
      answers: { 'npm install -g gentle-pi': { code: null, timedOut: true } }
    })
    await expect(installHostProgram('gentle-shell', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'The step took too long and was stopped.'
    })
  })

  it('reports unsupported with the vendor command when no install fits the host', async () => {
    const host = fakeHost({ platform: 'linux', present: {} })
    await expect(installHostProgram('gentle-shell', host)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported',
      command: 'npm install -g gentle-pi'
    })
  })

  it('runs the Antigravity vendor script as a constant script', async () => {
    const script = 'curl -fsSL https://antigravity.google/cli/install.sh | bash'
    const host = fakeHost({
      platform: 'darwin',
      present: { curl: '/usr/bin/curl', bash: '/bin/bash' },
      answers: { [`script:${script}`]: { code: 0 } },
      effects: { [`script:${script}`]: (h) => h.present.set('agy', '/Users/u/.local/bin/agy') }
    })
    await expect(installHostProgram('antigravity', host)).resolves.toMatchObject({ ok: true })
  })
})

describe('uninstall', () => {
  it('reports not-installed when the program is absent', async () => {
    const host = fakeHost({ platform: 'linux', present: {} })
    await expect(uninstallHostProgram('git', host)).resolves.toEqual({
      ok: false,
      reason: 'not-installed'
    })
  })

  it('removes a winget install through winget, the way it was installed', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: {
        winget: 'C:\\winget.exe',
        claude:
          'C:\\Users\\u\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode\\claude.exe'
      },
      answers: {
        [WINGET_CLAUDE_LIST]: { code: 0, stdout: 'Anthropic.ClaudeCode 2.1' },
        [WINGET_CLAUDE_REMOVE]: { code: 0 }
      },
      effects: { [WINGET_CLAUDE_REMOVE]: (h) => h.present.delete('claude') }
    })
    await expect(uninstallHostProgram('claude', host)).resolves.toEqual({ ok: true })
    expect(host.calls).toContain(WINGET_CLAUDE_REMOVE)
  })

  it('removes an npm install with npm uninstall -g and leaves the data folder alone', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm', codex: '/usr/lib/node_modules/.bin/codex' },
      answers: {
        'npm ls -g --depth=0 @openai/codex': { code: 0, stdout: '`-- @openai/codex@0.1.0' },
        'npm uninstall -g @openai/codex': { code: 0 }
      },
      effects: { 'npm uninstall -g @openai/codex': (h) => h.present.delete('codex') }
    })
    await expect(uninstallHostProgram('codex', host)).resolves.toEqual({ ok: true })
    expect(host.calls.join('\n')).not.toMatch(/\.codex/)
  })

  it('removes a native Claude Code install by the files the vendor documents', async () => {
    const script = 'rm -f "$HOME/.local/bin/claude" && rm -rf "$HOME/.local/share/claude"'
    const host = fakeHost({
      platform: 'linux',
      present: { claude: '/home/u/.local/bin/claude' },
      answers: { [`script:${script}`]: { code: 0 } },
      effects: { [`script:${script}`]: (h) => h.present.delete('claude') }
    })
    await expect(uninstallHostProgram('claude', host)).resolves.toEqual({ ok: true })
  })

  it('says so when a Codex copy is outside the vendor install folder, and removes nothing', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { codex: 'D:\\Apps\\OpenAI\\Codex\\bin\\codex.exe' }
    })
    const result = await uninstallHostProgram('codex', host)
    expect(result).toMatchObject({ ok: false, reason: 'unsupported' })
    expect(result.ok === false && result.message).toContain('OpenAI\\Codex')
    expect(host.calls.some((call) => call.includes('uninstall') || call.includes('Delete'))).toBe(
      false
    )
  })

  it('will not remove Node.js that a version manager owns', async () => {
    const host = fakeHost({
      platform: 'win32',
      present: { winget: 'C:\\winget.exe', node: 'C:\\nvm4w\\nodejs\\node.exe' }
    })
    await expect(uninstallHostProgram('node', host)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
    expect(host.calls.some((call) => call.includes('winget uninstall'))).toBe(false)
  })

  it('will not guess how an unknown install was made', async () => {
    const host = fakeHost({ platform: 'linux', present: { git: '/opt/tools/git' } })
    await expect(uninstallHostProgram('git', host)).resolves.toMatchObject({
      ok: false,
      reason: 'unsupported'
    })
  })

  it('reports needs-admin when removing a system package needs a password', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { git: '/usr/bin/git', 'apt-get': '/usr/bin/apt-get' },
      answers: {
        'dpkg -s git': { code: 0, stdout: 'Status: install ok installed\n' },
        'sudo -n true': { code: 1 }
      }
    })
    await expect(uninstallHostProgram('git', host)).resolves.toMatchObject({
      ok: false,
      reason: 'needs-admin',
      command: 'sudo apt-get remove -y git'
    })
  })

  it('reports failed when another copy of the program remains', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm', 'gentle-shell': '/usr/bin/gentle-shell' },
      answers: {
        'npm ls -g --depth=0 gentle-pi': { code: 0, stdout: 'gentle-pi@1.0.0' },
        'npm uninstall -g gentle-pi': { code: 0 }
      }
    })
    await expect(uninstallHostProgram('gentle-shell', host)).resolves.toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'Another copy of Gentle Shell remains at /usr/bin/gentle-shell.'
    })
  })
})

describe('status', () => {
  it('offers install on a host without the program', async () => {
    const host = fakeHost({ platform: 'darwin', present: { brew: '/opt/homebrew/bin/brew' } })
    await expect(hostProgramStatus('git', host)).resolves.toMatchObject({
      ok: true,
      installed: false,
      canInstall: true,
      canUninstall: false,
      installCommand: 'brew install git'
    })
  })

  it('names the method an existing install came from and what removes it', async () => {
    const host = fakeHost({
      platform: 'linux',
      present: { npm: '/usr/bin/npm', claude: '/usr/lib/node_modules/.bin/claude' },
      answers: {
        'npm ls -g --depth=0 @anthropic-ai/claude-code': {
          code: 0,
          stdout: '@anthropic-ai/claude-code@2'
        }
      }
    })
    await expect(hostProgramStatus('claude', host)).resolves.toMatchObject({
      installed: true,
      method: 'npm',
      canUninstall: true,
      uninstallCommand: 'npm uninstall -g @anthropic-ai/claude-code'
    })
  })

  it('explains why an unknown install cannot be removed', async () => {
    const host = fakeHost({ platform: 'linux', present: { git: '/opt/tools/git' } })
    const status = await hostProgramStatus('git', host)
    expect(status).toMatchObject({ installed: true, method: 'unknown', canUninstall: false })
    expect(status.ok && status.note).toContain('/opt/tools/git')
  })
})

describe('failureMessage', () => {
  it('drops terminal escapes and cuts long output', () => {
    const noisy = `\u001b[31mboom\u001b[0m ${'x'.repeat(500)}`
    const message = failureMessage({ code: 1, stdout: '', stderr: noisy, timedOut: false })
    expect(message.startsWith('boom')).toBe(true)
    expect(message.length).toBe(300)
  })
})
