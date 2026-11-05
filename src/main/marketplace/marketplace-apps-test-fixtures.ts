import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { _resetSecretStoreForTests, setSecretStore } from '../../shared/secret-store'
import type { MarketplaceAgentPaths } from './marketplace-agent-paths'

export function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), 'marketplace-home-'))
}

/** Windows needs a privilege for file links; folder junctions need none. */
export function canCreateFileLinks(): boolean {
  const probe = mkdtempSync(join(tmpdir(), 'marketplace-link-probe-'))
  try {
    writeFileSync(join(probe, 'target'), 'x')
    symlinkSync(join(probe, 'target'), join(probe, 'link'), 'file')
    return true
  } catch {
    return false
  } finally {
    rmSync(probe, { recursive: true, force: true })
  }
}

/** A fake OS keyring: sealed values are visibly not the token. */
export function installFakeSecretStore(available = true): void {
  setSecretStore({
    isEncryptionAvailable: () => available,
    describeProtectionGap: () => (available ? null : 'no keyring'),
    encryptString: (value) => Buffer.from(`sealed:${Buffer.from(value).toString('base64')}`),
    decryptString: (value) => {
      const text = value.toString()
      if (!text.startsWith('sealed:')) {
        throw new Error('not sealed')
      }
      return Buffer.from(text.slice(7), 'base64').toString()
    }
  })
}

export function resetFakeSecretStore(): void {
  _resetSecretStoreForTests()
}

export function testAgentPaths(home: string): MarketplaceAgentPaths {
  return {
    home: () => home,
    mcpConfig: (agent: MarketplaceAppAgent) => {
      switch (agent) {
        case 'claude':
          return join(home, '.claude.json')
        case 'codex':
          return join(home, '.codex', 'config.toml')
        case 'antigravity':
          return join(home, '.gemini', 'config', 'mcp_config.json')
        case 'gentle-shell':
          return join(home, '.gentle-shell', 'agent', 'mcp.json')
      }
    },
    instructions: (agent) => {
      switch (agent) {
        case 'claude':
          return join(home, '.claude', 'CLAUDE.md')
        case 'codex':
          return join(home, '.codex', 'AGENTS.md')
        case 'antigravity':
        case 'gentle-shell':
          return null
      }
    },
    presenceDir: (agent) => {
      switch (agent) {
        case 'claude':
          return join(home, '.claude')
        case 'codex':
          return join(home, '.codex')
        case 'antigravity':
          return join(home, '.gemini')
        case 'gentle-shell':
          return join(home, '.gentle-shell', 'agent')
      }
    }
  }
}

/** Creates every agent's home folder so MassOrca treats all four as installed. */
export function installAllAgents(home: string): void {
  for (const dir of ['.claude', '.codex', '.gemini', join('.gentle-shell', 'agent')]) {
    mkdirSync(join(home, dir), { recursive: true })
  }
}

export function writeFixture(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}
