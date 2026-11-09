import { describe, expect, it } from 'vitest'
import type { MarketplaceHostProgramId } from '../../../shared/rpc-contract/marketplace-host-program-params'
import { programSpec } from './host-program-catalog'
import { planInstall, planRemoval, type HostFacts } from './host-program-plan'
import type { HostPlatform } from './host-program-types'

function facts(
  platform: HostPlatform,
  has: string[],
  extra: Partial<Pick<HostFacts, 'isRoot' | 'family'>> = {}
): HostFacts {
  return {
    platform,
    has: new Set(has),
    isRoot: extra.isRoot ?? false,
    family: extra.family ?? (platform === 'linux' ? 'debian' : null),
    home: null,
    localAppData: null,
    userProfile: null
  }
}

const WINGET_FLAGS = '--silent --accept-source-agreements --accept-package-agreements'
const wingetInstall = (id: string): string =>
  `winget install --id ${id} -e --source winget ${WINGET_FLAGS}`
const wingetRemove = (id: string): string =>
  `winget uninstall --id ${id} -e --silent --accept-source-agreements`

describe('install command per program and host', () => {
  const cases: [MarketplaceHostProgramId, HostFacts, string][] = [
    ['claude', facts('win32', ['winget', 'npm']), wingetInstall('Anthropic.ClaudeCode')],
    ['claude', facts('win32', ['npm']), 'npm install -g @anthropic-ai/claude-code'],
    ['claude', facts('win32', []), 'irm https://claude.ai/install.ps1 | iex'],
    [
      'claude',
      facts('linux', ['curl', 'bash', 'npm']),
      'curl -fsSL https://claude.ai/install.sh | bash'
    ],
    ['claude', facts('linux', ['npm']), 'npm install -g @anthropic-ai/claude-code'],
    [
      'claude',
      facts('darwin', ['curl', 'bash', 'brew']),
      'curl -fsSL https://claude.ai/install.sh | bash'
    ],
    ['claude', facts('darwin', ['brew']), 'brew install --cask claude-code'],
    ['codex', facts('win32', ['npm']), 'npm install -g @openai/codex'],
    ['codex', facts('win32', []), 'irm https://chatgpt.com/codex/install.ps1 | iex'],
    ['codex', facts('darwin', ['brew']), 'brew install --cask codex'],
    [
      'codex',
      facts('linux', ['curl', 'bash']),
      'curl -fsSL https://chatgpt.com/codex/install.sh | sh'
    ],
    [
      'antigravity',
      facts('win32', ['winget']),
      'irm https://antigravity.google/cli/install.ps1 | iex'
    ],
    [
      'antigravity',
      facts('darwin', ['curl', 'bash']),
      'curl -fsSL https://antigravity.google/cli/install.sh | bash'
    ],
    ['gentle-shell', facts('linux', ['npm']), 'npm install -g gentle-pi'],
    ['gentle-shell', facts('win32', ['npm']), 'npm install -g gentle-pi'],
    ['git', facts('win32', ['winget']), wingetInstall('Git.Git')],
    ['git', facts('darwin', ['brew']), 'brew install git'],
    ['git', facts('linux', ['apt-get']), 'sudo apt-get install -y git'],
    ['git', facts('linux', ['apt-get'], { isRoot: true }), 'apt-get install -y git'],
    ['git', facts('linux', ['dnf'], { family: 'fedora' }), 'sudo dnf install -y git'],
    ['gh', facts('win32', ['winget']), wingetInstall('GitHub.cli')],
    ['gh', facts('darwin', ['brew']), 'brew install gh'],
    ['gh', facts('linux', ['apt-get']), 'sudo apt-get install -y gh'],
    ['node', facts('win32', ['winget']), wingetInstall('OpenJS.NodeJS.LTS')],
    ['node', facts('darwin', ['brew']), 'brew install node'],
    ['node', facts('linux', ['apt-get']), 'sudo apt-get install -y nodejs npm']
  ]
  it.each(cases)('%s builds one command', (id, hostFacts, expected) => {
    expect(planInstall(programSpec(id), hostFacts)?.display).toBe(expected)
  })

  it('offers nothing when the host has no way the vendor documents', () => {
    expect(planInstall(programSpec('gentle-shell'), facts('linux', ['curl']))).toBeNull()
    expect(planInstall(programSpec('antigravity'), facts('linux', ['npm']))).toBeNull()
    expect(planInstall(programSpec('git'), facts('darwin', []))).toBeNull()
  })

  it('checks sudo without a password before a package manager runs as a non-root user', () => {
    const plan = planInstall(programSpec('git'), facts('linux', ['apt-get']))
    expect(plan?.steps.map((step) => step.argv?.join(' '))).toEqual([
      'sudo -n true',
      'sudo -n apt-get install -y git'
    ])
    expect(plan?.steps[0]?.adminCheck).toBe(true)
    expect(plan?.needsSudo).toBe(true)
  })

  it('never builds a shell string from an argv step', () => {
    const plan = planInstall(programSpec('claude'), facts('win32', ['npm']))
    expect(plan?.steps.every((step) => step.script === undefined)).toBe(true)
  })
})

describe('uninstall command per owner', () => {
  const pick = (id: MarketplaceHostProgramId, platform: HostPlatform, method: string) => {
    const option = programSpec(id).options[platform].find((entry) => entry.method === method)
    if (!option) {
      throw new Error(`no ${method} option`)
    }
    return option
  }
  const cases: [MarketplaceHostProgramId, HostPlatform, string, string][] = [
    ['claude', 'win32', 'winget', wingetRemove('Anthropic.ClaudeCode')],
    ['claude', 'win32', 'npm', 'npm uninstall -g @anthropic-ai/claude-code'],
    ['claude', 'darwin', 'brew', 'brew uninstall --cask claude-code'],
    ['codex', 'linux', 'npm', 'npm uninstall -g @openai/codex'],
    ['codex', 'darwin', 'brew', 'brew uninstall --cask codex'],
    ['gentle-shell', 'linux', 'npm', 'npm uninstall -g gentle-pi'],
    ['git', 'win32', 'winget', wingetRemove('Git.Git')],
    ['git', 'darwin', 'brew', 'brew uninstall git'],
    ['git', 'linux', 'apt', 'sudo apt-get remove -y git'],
    ['git', 'linux', 'dnf', 'sudo dnf remove -y git'],
    ['gh', 'win32', 'winget', wingetRemove('GitHub.cli')],
    ['gh', 'linux', 'apt', 'sudo apt-get remove -y gh'],
    ['node', 'win32', 'winget', wingetRemove('OpenJS.NodeJS.LTS')],
    ['node', 'linux', 'apt', 'sudo apt-get remove -y nodejs npm']
  ]
  it.each(cases)('%s on %s through %s', (id, platform, method, expected) => {
    const plan = planRemoval(pick(id, platform, method), facts(platform, []))
    expect(plan?.display).toBe(expected)
  })

  it('removes only the Gentle Shell package, never its self-uninstall that deletes chats and sign-ins', () => {
    const option = pick('gentle-shell', 'linux', 'npm')
    const plan = planRemoval(option, facts('linux', []))
    expect(plan?.display).not.toContain('self-uninstall')
  })
})
