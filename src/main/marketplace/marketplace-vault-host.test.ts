import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MARKETPLACE_REMOTE_CREDENTIAL_SLOTS } from '../../shared/marketplace-apps'
import { makeTempHome } from './marketplace-apps-test-fixtures'
import { emptyMarketplaceState, MarketplaceVault } from './marketplace-vault'
import {
  clearVaultHostCredential,
  clearVaultHostProfileCredential,
  readVaultHostStatus,
  setVaultHostCredential,
  setVaultHostProfileCredential
} from './marketplace-vault-host'

const TOKEN = 'tok-SECRET-123'
let home: string
let vault: MarketplaceVault

function withProfiles(...names: string[]): void {
  const state = emptyMarketplaceState()
  state.openMetadata.profiles = names.map((name) => ({ name, url: 'https://om.example.com/mcp' }))
  vault.writeState(state)
}

beforeEach(() => {
  home = makeTempHome()
  vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'srv2056164'
  })
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('vault host status', () => {
  it('lists the profiles of the host with set or not set, never a value', () => {
    withProfiles('escritura', 'lectura')
    vault.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, TOKEN)
    const status = readVaultHostStatus(vault)
    expect(status.profiles).toEqual([
      { name: 'escritura', stored: true, updatedAt: expect.any(Number) },
      { name: 'lectura', stored: false }
    ])
    expect(JSON.stringify(status)).not.toContain(TOKEN)
  })

  it('answers an empty profile list when the host has none', () => {
    expect(readVaultHostStatus(vault).profiles).toEqual([])
  })

  it('keeps the fields an older client reads, so an old client ignores the new list', () => {
    withProfiles('escritura')
    const legacyAnswer = z.object({
      hostLabel: z.string(),
      store: z.enum(['keychain', 'key-file']),
      credentials: z.array(
        z.object({
          slot: z.enum(MARKETPLACE_REMOTE_CREDENTIAL_SLOTS),
          stored: z.boolean(),
          updatedAt: z.number().optional()
        })
      )
    })
    const parsed = legacyAnswer.parse(readVaultHostStatus(vault))
    expect(parsed.credentials.map((credential) => credential.slot)).toEqual([
      'openmetadata',
      'engram-cloud'
    ])
    expect('profiles' in parsed).toBe(false)
  })
})

describe('profile tokens on a host vault', () => {
  it('stores the token of a profile the host knows and injects it into the host env', () => {
    withProfiles('escritura')
    const result = setVaultHostProfileCredential(vault, { name: 'escritura', token: TOKEN })
    expect(result).toMatchObject({
      ok: true,
      status: { profiles: [{ name: 'escritura', stored: true }] }
    })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN_ESCRITURA: TOKEN })
  })

  it('replaces the token of a profile', () => {
    withProfiles('escritura')
    setVaultHostProfileCredential(vault, { name: 'escritura', token: TOKEN })
    setVaultHostProfileCredential(vault, { name: 'escritura', token: 'rotated-token' })
    expect(vault.buildAgentEnv().OPENMETADATA_TOKEN_ESCRITURA).toBe('rotated-token')
  })

  it('refuses a profile the host does not list, so no token is stored that no agent would get', () => {
    withProfiles('lectura')
    expect(setVaultHostProfileCredential(vault, { name: 'escritura', token: TOKEN })).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    expect(vault.hasToken({ kind: 'openmetadata-profile', name: 'escritura' })).toBe(false)
  })

  it.each([
    [{ name: 'openmetadata', token: TOKEN }],
    [{ name: 'has space', token: TOKEN }],
    [{ name: '../escape', token: TOKEN }],
    [{ name: 'escritura', token: 'two words' }],
    [{ name: 'escritura' }],
    [{ token: TOKEN }],
    [null]
  ])('refuses %j with the same checks as a local profile', (args) => {
    withProfiles('escritura', 'openmetadata')
    expect(setVaultHostProfileCredential(vault, args)).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    expect(vault.isEmpty()).toBe(false)
    expect(vault.hasToken({ kind: 'openmetadata-profile', name: 'escritura' })).toBe(false)
  })

  it('clears the token of a profile and leaves the profile and the other tokens', () => {
    withProfiles('escritura')
    vault.writeToken({ kind: 'openmetadata' }, 'main-token')
    setVaultHostProfileCredential(vault, { name: 'escritura', token: TOKEN })
    const result = clearVaultHostProfileCredential(vault, { name: 'escritura' })
    expect(result).toMatchObject({
      ok: true,
      status: { profiles: [{ name: 'escritura', stored: false }] }
    })
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'main-token' })
    expect(vault.readState().openMetadata.profiles).toHaveLength(1)
  })

  it('refuses to clear a name that is not a valid profile name', () => {
    expect(clearVaultHostProfileCredential(vault, { name: '../escape' })).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
    expect(clearVaultHostProfileCredential(vault, {})).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
  })
})

describe('requests from an older client', () => {
  it('still sets and clears the two original slots with the old shape', () => {
    const set = setVaultHostCredential(vault, { slot: 'openmetadata', token: TOKEN })
    expect(set).toMatchObject({
      ok: true,
      status: { credentials: [{ slot: 'openmetadata', stored: true }, { slot: 'engram-cloud' }] }
    })
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: TOKEN })
    clearVaultHostCredential(vault, { slot: 'openmetadata' })
    expect(vault.buildAgentEnv()).toEqual({})
  })

  it('does not take a profile through the old slot field', () => {
    withProfiles('escritura')
    expect(
      setVaultHostCredential(vault, {
        slot: { kind: 'openmetadata-profile', name: 'escritura' },
        token: TOKEN
      })
    ).toEqual({ ok: false, reason: 'invalid-input' })
  })
})
