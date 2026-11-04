import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import {
  ENGRAM_CLOUD_SERVER_ENV,
  ENGRAM_CLOUD_TOKEN_ENV,
  MARKETPLACE_APP_AGENTS,
  OPENMETADATA_TOKEN_ENV,
  openMetadataProfileTokenEnv
} from '../../shared/marketplace-apps'
import { getSecretStore } from '../../shared/secret-store'
import { credentialFileHasContent, writeCredentialFileAtomic } from '../integration-credential-file'

export type VaultSlot =
  | { kind: 'openmetadata' }
  | { kind: 'openmetadata-profile'; name: string }
  | { kind: 'engram-cloud' }

const agentWritesSchema = z.object({ entries: z.array(z.string()), instructions: z.boolean() })
const writtenSchema = z.partialRecord(z.enum(MARKETPLACE_APP_AGENTS), agentWritesSchema)

// Why: only settings and what MassOrca wrote live here; a token never reaches this file.
const stateSchema = z.object({
  version: z.literal(1),
  openMetadata: z.object({
    url: z.string().nullable(),
    profiles: z.array(z.object({ name: z.string(), url: z.string() }))
  }),
  engram: z.object({ connected: z.boolean(), serverUrl: z.string().nullable() }),
  // Why: Disconnect hides GitHub from MassOrca only; gh keeps its accounts.
  github: z.object({ hidden: z.boolean() }).default({ hidden: false }),
  written: z.object({ engram: writtenSchema, openmetadata: writtenSchema })
})

export type MarketplaceState = z.infer<typeof stateSchema>
export type MarketplaceAgentWrites = MarketplaceState['written']['engram']

export function emptyMarketplaceState(): MarketplaceState {
  return {
    version: 1,
    openMetadata: { url: null, profiles: [] },
    engram: { connected: false, serverUrl: null },
    github: { hidden: false },
    written: { engram: {}, openmetadata: {} }
  }
}

export function defaultMarketplaceVaultDir(): string {
  return join(homedir(), '.orca', 'marketplace')
}

function slotFileName(slot: VaultSlot): string {
  switch (slot.kind) {
    case 'openmetadata':
      return 'openmetadata-token.enc'
    case 'openmetadata-profile':
      return `openmetadata-profile-${Buffer.from(slot.name).toString('base64url')}.enc`
    case 'engram-cloud':
      return 'engram-cloud-token.enc'
  }
}

/** Tokens sealed by the OS keyring plus a small settings file, in one folder on this computer. */
export class MarketplaceVault {
  private envCache: Record<string, string> | null = null

  constructor(private readonly dir: string = defaultMarketplaceVaultDir()) {}

  encryptionAvailable(): boolean {
    try {
      return getSecretStore().isEncryptionAvailable()
    } catch {
      return false
    }
  }

  private pathFor(slot: VaultSlot): string {
    return join(this.dir, slotFileName(slot))
  }

  private ensureDir(): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 })
  }

  hasToken(slot: VaultSlot): boolean {
    return credentialFileHasContent(this.pathFor(slot))
  }

  /** Never falls back to reading plaintext: the vault only holds sealed tokens. */
  readToken(slot: VaultSlot): string | null {
    if (!this.encryptionAvailable()) {
      return null
    }
    try {
      const raw = readFileSync(this.pathFor(slot))
      const token = raw.length > 0 ? getSecretStore().decryptString(raw) : ''
      return token.length > 0 ? token : null
    } catch {
      return null
    }
  }

  /** False, with nothing written, when the OS cannot seal the token. */
  writeToken(slot: VaultSlot, token: string): boolean {
    if (!this.encryptionAvailable()) {
      return false
    }
    this.ensureDir()
    writeCredentialFileAtomic(this.pathFor(slot), getSecretStore().encryptString(token))
    this.envCache = null
    return true
  }

  deleteToken(slot: VaultSlot): void {
    rmSync(this.pathFor(slot), { force: true })
    this.envCache = null
  }

  readState(): MarketplaceState {
    try {
      const parsed = stateSchema.safeParse(
        JSON.parse(readFileSync(join(this.dir, 'state.json'), 'utf8'))
      )
      return parsed.success ? parsed.data : emptyMarketplaceState()
    } catch {
      return emptyMarketplaceState()
    }
  }

  writeState(state: MarketplaceState): void {
    this.ensureDir()
    writeCredentialFileAtomic(
      join(this.dir, 'state.json'),
      Buffer.from(JSON.stringify(state, null, 2))
    )
    this.envCache = null
  }

  clearState(): void {
    rmSync(join(this.dir, 'state.json'), { force: true })
    this.envCache = null
  }

  /** Env vars for agents MassOrca launches; names and values only for what is stored. */
  buildAgentEnv(): Record<string, string> {
    if (this.envCache) {
      return { ...this.envCache }
    }
    const env: Record<string, string> = {}
    const state = this.readState()
    const add = (name: string, slot: VaultSlot): void => {
      const token = this.readToken(slot)
      if (token) {
        env[name] = token
      }
    }
    add(OPENMETADATA_TOKEN_ENV, { kind: 'openmetadata' })
    for (const profile of state.openMetadata.profiles) {
      add(openMetadataProfileTokenEnv(profile.name), {
        kind: 'openmetadata-profile',
        name: profile.name
      })
    }
    add(ENGRAM_CLOUD_TOKEN_ENV, { kind: 'engram-cloud' })
    if (state.engram.serverUrl) {
      env[ENGRAM_CLOUD_SERVER_ENV] = state.engram.serverUrl
    }
    this.envCache = env
    return { ...env }
  }
}

let defaultVault: MarketplaceVault | null = null

export function getMarketplaceVault(): MarketplaceVault {
  defaultVault ??= new MarketplaceVault()
  return defaultVault
}
