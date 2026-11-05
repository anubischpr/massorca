import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore
} from './marketplace-apps-test-fixtures'
import { MarketplaceVault, emptyMarketplaceState } from './marketplace-vault'

let dir: string
beforeEach(() => {
  dir = join(makeTempHome(), 'marketplace')
  installFakeSecretStore(true)
})
afterEach(() => {
  rmSync(join(dir, '..'), { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('MarketplaceVault tokens', () => {
  it('stores a token sealed and reads it back', () => {
    const vault = new MarketplaceVault(dir)
    expect(vault.writeToken({ kind: 'openmetadata' }, 'tok-123')).toBe(true)
    expect(vault.hasToken({ kind: 'openmetadata' })).toBe(true)
    expect(vault.readToken({ kind: 'openmetadata' })).toBe('tok-123')
    expect(readFileSync(join(dir, 'openmetadata-token.enc'), 'utf8')).not.toContain('tok-123')
  })

  it('seals with a key file when the OS keychain is unavailable', () => {
    installFakeSecretStore(false)
    const vault = new MarketplaceVault(dir)
    expect(vault.writeToken({ kind: 'engram-cloud' }, 'tok-123')).toBe(true)
    expect(vault.readToken({ kind: 'engram-cloud' })).toBe('tok-123')
    expect(vault.location().store).toBe('key-file')
  })

  it('never reads a plaintext file as a token', () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'openmetadata-token.enc'), 'plain-token')
    expect(new MarketplaceVault(dir).readToken({ kind: 'openmetadata' })).toBeNull()
  })

  it('keeps one file per profile, named from the profile', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata-profile', name: 'Ana-1' }, 'a')
    vault.writeToken({ kind: 'openmetadata-profile', name: 'Luis' }, 'b')
    expect(vault.readToken({ kind: 'openmetadata-profile', name: 'Ana-1' })).toBe('a')
    expect(readdirSync(dir).sort()).toEqual([
      `openmetadata-profile-${Buffer.from('Ana-1').toString('base64url')}.enc`,
      `openmetadata-profile-${Buffer.from('Luis').toString('base64url')}.enc`
    ])
  })
})

describe('MarketplaceVault state', () => {
  it('round-trips settings and never writes a token into them', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata' }, 'tok-123')
    const state = emptyMarketplaceState()
    state.openMetadata = {
      url: 'https://om.example/mcp',
      profiles: [{ name: 'a', url: 'https://x' }]
    }
    state.written.engram.claude = { entries: ['engram'], instructions: true }
    vault.writeState(state)
    expect(vault.readState()).toEqual(state)
    expect(readFileSync(join(dir, 'state.json'), 'utf8')).not.toContain('tok-123')
  })

  it('falls back to an empty state for a missing or damaged file', () => {
    const vault = new MarketplaceVault(dir)
    expect(vault.readState()).toEqual(emptyMarketplaceState())
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'state.json'), '{"version":2}')
    expect(vault.readState()).toEqual(emptyMarketplaceState())
  })
})

describe('MarketplaceVault agent env', () => {
  it('is empty when nothing is stored', () => {
    expect(new MarketplaceVault(dir).buildAgentEnv()).toEqual({})
  })

  it('names each stored credential and nothing else', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata' }, 'main-token')
    vault.writeToken({ kind: 'openmetadata-profile', name: 'ana-1' }, 'ana-token')
    vault.writeToken({ kind: 'openmetadata-profile', name: 'orphan' }, 'orphan-token')
    vault.writeToken({ kind: 'engram-cloud' }, 'cloud-token')
    const state = emptyMarketplaceState()
    state.openMetadata.profiles = [{ name: 'ana-1', url: 'https://x' }]
    state.engram.serverUrl = 'https://engram.example'
    vault.writeState(state)
    expect(vault.buildAgentEnv()).toEqual({
      OPENMETADATA_TOKEN: 'main-token',
      OPENMETADATA_TOKEN_ANA_1: 'ana-token',
      ENGRAM_CLOUD_TOKEN: 'cloud-token',
      ENGRAM_CLOUD_SERVER: 'https://engram.example'
    })
  })

  it('reads the files once until something is written', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata' }, 'one')
    const read = vi.spyOn(vault, 'readToken')
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'one' })
    const readsForOneBuild = read.mock.calls.length
    expect(readsForOneBuild).toBeGreaterThan(0)
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'one' })
    expect(read).toHaveBeenCalledTimes(readsForOneBuild)
    vault.writeToken({ kind: 'openmetadata' }, 'two')
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'two' })
    vault.deleteToken({ kind: 'openmetadata' })
    expect(vault.buildAgentEnv()).toEqual({})
  })

  it('sees a token or profile another vault object wrote to the same folder', () => {
    const longLived = new MarketplaceVault(dir)
    longLived.writeToken({ kind: 'openmetadata' }, 'main-token')
    longLived.writeState(emptyMarketplaceState())
    expect(longLived.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'main-token' })

    const otherProcess = new MarketplaceVault(dir)
    otherProcess.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, 'profile-token')
    const state = emptyMarketplaceState()
    state.openMetadata.profiles = [{ name: 'escritura', url: 'https://x' }]
    otherProcess.writeState(state)

    expect(longLived.buildAgentEnv()).toEqual({
      OPENMETADATA_TOKEN: 'main-token',
      OPENMETADATA_TOKEN_ESCRITURA: 'profile-token'
    })
    otherProcess.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, 'rotated-token')
    expect(longLived.buildAgentEnv().OPENMETADATA_TOKEN_ESCRITURA).toBe('rotated-token')
    otherProcess.deleteToken({ kind: 'openmetadata-profile', name: 'escritura' })
    expect(longLived.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'main-token' })
  })

  it('returns a copy, so a caller cannot change what the next call sees', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata' }, 'one')
    Object.assign(vault.buildAgentEnv(), { OPENMETADATA_TOKEN: 'changed' })
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'one' })
  })
})
