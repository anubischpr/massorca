import type { MarketplaceHostProgramId } from '../../../shared/rpc-contract/marketplace-host-program-params'
import type { InstallOption, ProgramSpec } from './host-program-types'

function shellScript(url: string, shell: 'bash' | 'sh'): InstallOption {
  const text = `curl -fsSL ${url} | ${shell}`
  return { method: 'script', text, display: text, shell: 'sh' }
}

function powershellScript(url: string): InstallOption {
  const text = `irm ${url} | iex`
  return { method: 'script', text, display: text, shell: 'powershell' }
}

const CLAUDE_NPM: InstallOption = { method: 'npm', pkg: '@anthropic-ai/claude-code' }
const CLAUDE_BREW: InstallOption = { method: 'brew', name: 'claude-code', cask: true }
const CODEX_NPM: InstallOption = { method: 'npm', pkg: '@openai/codex' }
const CODEX_BREW: InstallOption = { method: 'brew', name: 'codex', cask: true }

// Why these sources: each is the vendor's own documented install (Claude Code setup page, the Codex
// README, the Antigravity CLI quickstart, the gentle-pi README), and no method here invents a URL.
const SPECS: Record<MarketplaceHostProgramId, ProgramSpec> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    command: 'claude',
    options: {
      win32: [
        { method: 'winget', id: 'Anthropic.ClaudeCode' },
        CLAUDE_NPM,
        powershellScript('https://claude.ai/install.ps1')
      ],
      darwin: [shellScript('https://claude.ai/install.sh', 'bash'), CLAUDE_BREW, CLAUDE_NPM],
      linux: [
        shellScript('https://claude.ai/install.sh', 'bash'),
        CLAUDE_NPM,
        CLAUDE_BREW,
        { method: 'apt', pkgs: ['claude-code'], installable: false },
        { method: 'dnf', pkgs: ['claude-code'], installable: false }
      ]
    },
    nativePath: /[\\/]\.local[\\/](?:bin|share)[\\/]/,
    keepsData: '~/.claude and ~/.claude.json'
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    command: 'codex',
    options: {
      win32: [CODEX_NPM, powershellScript('https://chatgpt.com/codex/install.ps1')],
      darwin: [CODEX_NPM, CODEX_BREW, shellScript('https://chatgpt.com/codex/install.sh', 'sh')],
      linux: [CODEX_NPM, CODEX_BREW, shellScript('https://chatgpt.com/codex/install.sh', 'sh')]
    },
    nativePath: /[\\/]OpenAI[\\/]Codex[\\/]|[\\/]\.codex[\\/]|[\\/]\.local[\\/]bin[\\/]/,
    keepsData: '~/.codex'
  },
  antigravity: {
    id: 'antigravity',
    label: 'Antigravity',
    command: 'agy',
    options: {
      win32: [powershellScript('https://antigravity.google/cli/install.ps1')],
      darwin: [shellScript('https://antigravity.google/cli/install.sh', 'bash')],
      linux: [shellScript('https://antigravity.google/cli/install.sh', 'bash')]
    },
    nativePath: /[\\/]agy[\\/]|[\\/]\.agy[\\/]|[\\/]\.local[\\/]bin[\\/]|[\\/]\.antigravity[\\/]/
  },
  'gentle-shell': {
    id: 'gentle-shell',
    label: 'Gentle Shell',
    command: 'gentle-shell',
    options: {
      win32: [{ method: 'npm', pkg: 'gentle-pi' }],
      darwin: [{ method: 'npm', pkg: 'gentle-pi' }],
      linux: [{ method: 'npm', pkg: 'gentle-pi' }]
    },
    // Why not `gentle-shell self-uninstall`: it also deletes the isolated home with the person's chats and sign-ins.
    keepsData: '~/.gentle-shell'
  },
  git: {
    id: 'git',
    label: 'Git',
    command: 'git',
    options: {
      win32: [{ method: 'winget', id: 'Git.Git' }],
      darwin: [{ method: 'brew', name: 'git' }],
      linux: [
        { method: 'apt', pkgs: ['git'] },
        { method: 'dnf', pkgs: ['git'] },
        { method: 'brew', name: 'git' }
      ]
    }
  },
  gh: {
    id: 'gh',
    label: 'GitHub CLI',
    command: 'gh',
    options: {
      win32: [{ method: 'winget', id: 'GitHub.cli' }],
      darwin: [{ method: 'brew', name: 'gh' }],
      linux: [
        { method: 'apt', pkgs: ['gh'] },
        { method: 'dnf', pkgs: ['gh'] },
        { method: 'brew', name: 'gh' }
      ]
    },
    keepsData: '~/.config/gh (your sign-ins)'
  },
  node: {
    id: 'node',
    label: 'Node.js',
    command: 'node',
    options: {
      win32: [{ method: 'winget', id: 'OpenJS.NodeJS.LTS' }],
      darwin: [{ method: 'brew', name: 'node' }],
      linux: [
        { method: 'apt', pkgs: ['nodejs', 'npm'] },
        { method: 'dnf', pkgs: ['nodejs', 'npm'] },
        { method: 'brew', name: 'node' }
      ]
    },
    versionManaged: true
  }
}

export function programSpec(id: MarketplaceHostProgramId): ProgramSpec {
  return SPECS[id]
}
