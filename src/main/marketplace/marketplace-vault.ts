import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { z } from 'zod'
import {
  ENGRAM_CLOUD_SERVER_ENV,
  ENGRAM_CLOUD_TOKEN_ENV,
  MARKETPLACE_APP_AGENTS,
  OPENMETADATA_TOKEN_ENV,
  isMarketplaceAppAllowedForAgent,
  openMetadataProfileTokenEnv,
  type MarketplaceAppAgent,
  type MarketplaceCredentialLocation,
  type MarketplaceCredentialStatus
} from '../../shared/marketplace-apps'
import { getSecretStore, hasSecretStore } from '../../shared/secret-store'
import { credentialFileHasContent, writeCredentialFileAtomic } from '../integration-credential-file'
import {
  everyoneAccessByApp,
  storedAccessSchema,
  storedAccessStrictSchema
} from './marketplace-access'
import { isSealedV2, openSecret, sealSecret, sealedUpdatedAt } from './marketplace-vault-crypto'
import { createMasterKeyProvider, type KeychainSealer } from './marketplace-vault-master-key'

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
  // Why: a state file from before access policies still parses, and reads as Everyone.
  access: storedAccessSchema,
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
    access: everyoneAccessByApp(),
    written: { engram: {}, openmetadata: {} }
  }
}

/** The apps whose tokens reach agents as env vars. */
const ENV_APPS = ['engram', 'openmetadata'] as const
type EnvApp = (typeof ENV_APPS)[number]

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

export type MarketplaceVaultOptions = {
  /** Where the master key lives; never inside the ciphertext folder. Default: `keys` beside it. */
  keyDir?: string
  /** The OS keychain wrapper; none on a plain Node host, which then uses the key file. */
  sealer?: () => KeychainSealer | null
  hostLabel?: string
}

function desktopKeychain(): KeychainSealer | null {
  return hasSecretStore() ? getSecretStore() : null
}

/**
 * Tokens sealed with AES-256-GCM plus a small settings file, in one folder on one host. The master
 * key is wrapped by the OS keychain when there is one, otherwise it is a separate 0600 key file.
 */
export class MarketplaceVault {
  private envCache: Record<EnvApp, Record<string, string>> | null = null
  private readonly keys: ReturnType<typeof createMasterKeyProvider>
  private readonly sealer: () => KeychainSealer | null
  private readonly hostLabel: string

  constructor(
    private readonly dir: string = defaultMarketplaceVaultDir(),
    options: MarketplaceVaultOptions = {}
  ) {
    const keyDir = options.keyDir ?? join(dirname(dir), 'keys')
    const rel = relative(dir, keyDir)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
      throw new Error('The vault key must not live beside the ciphertext')
    }
    this.sealer = options.sealer ?? desktopKeychain
    this.hostLabel = options.hostLabel ?? hostname()
    this.keys = createMasterKeyProvider({ keyDir, sealer: this.sealer })
  }

  /** Whether this host can seal a token right now (the master key exists or can be created). */
  encryptionAvailable(): boolean {
    return this.keys.resolve() !== null
  }

  location(): MarketplaceCredentialLocation {
    return { hostLabel: this.hostLabel, store: this.keys.store() }
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

  /** Set or not, when it last changed and where it lives; never the value. */
  credentialStatus(slot: VaultSlot): MarketplaceCredentialStatus {
    const path = this.pathFor(slot)
    try {
      if (statSync(path).size === 0) {
        return { stored: false }
      }
      const updatedAt = sealedUpdatedAt(readFileSync(path)) ?? Math.floor(statSync(path).mtimeMs)
      return { stored: true, updatedAt, location: this.location() }
    } catch {
      return { stored: false }
    }
  }

  /** True when no token and no settings were ever written, so a launch can skip the vault entirely. */
  isEmpty(): boolean {
    try {
      return !readdirSync(this.dir).some((name) => name === 'state.json' || name.endsWith('.enc'))
    } catch {
      return true
    }
  }

  /** Never falls back to reading plaintext: the vault only holds sealed tokens. */
  readToken(slot: VaultSlot): string | null {
    let blob: Buffer
    try {
      blob = readFileSync(this.pathFor(slot))
    } catch {
      return null
    }
    if (blob.length === 0) {
      return null
    }
    if (isSealedV2(blob)) {
      const master = this.keys.resolve()
      const token = master ? openSecret(master.key, slotFileName(slot), blob) : null
      return token !== null && token.length > 0 ? token : null
    }
    return this.migrateV1(slot, blob)
  }

  /** A v1 file was sealed by the OS keychain alone; open it once and re-seal it as v2. */
  private migrateV1(slot: VaultSlot, blob: Buffer): string | null {
    let token: string
    try {
      const keychain = this.sealer()
      if (!keychain?.isEncryptionAvailable()) {
        return null
      }
      token = keychain.decryptString(blob)
    } catch {
      return null
    }
    if (token.length === 0) {
      return null
    }
    try {
      const updatedAt = Math.floor(statSync(this.pathFor(slot)).mtimeMs)
      this.writeSealed(slot, token, updatedAt)
    } catch {
      // The v1 file stays readable; the next read tries again.
    }
    return token
  }

  private writeSealed(slot: VaultSlot, token: string, updatedAt: number): boolean {
    const master = this.keys.resolve()
    if (!master) {
      return false
    }
    this.ensureDir()
    writeCredentialFileAtomic(
      this.pathFor(slot),
      sealSecret(master.key, slotFileName(slot), token, updatedAt)
    )
    this.envCache = null
    return true
  }

  /** False, with nothing written, when this host cannot get a master key. */
  writeToken(slot: VaultSlot, token: string): boolean {
    try {
      return this.writeSealed(slot, token, Date.now())
    } catch {
      return false
    }
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

  /**
   * The state a bot run's denial is decided from. No file means nothing was ever stored; any other
   * read or parse failure throws, so the caller can deny every app instead of allowing them.
   */
  readStateForDenial(): MarketplaceState {
    let raw: string
    try {
      raw = readFileSync(join(this.dir, 'state.json'), 'utf8')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return emptyMarketplaceState()
      }
      throw error
    }
    const json: unknown = JSON.parse(raw)
    const state = stateSchema.parse(json)
    const access = storedAccessStrictSchema.parse(
      typeof json === 'object' && json !== null && 'access' in json ? json.access : undefined
    )
    return access ? { ...state, access } : state
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

  /** Env vars per app, read once until the state or a token changes; never handed out as is. */
  private readAppEnvs(): Record<EnvApp, Record<string, string>> {
    if (this.envCache) {
      return this.envCache
    }
    const state = this.readState()
    const envs: Record<EnvApp, Record<string, string>> = { engram: {}, openmetadata: {} }
    const add = (env: Record<string, string>, name: string, slot: VaultSlot): void => {
      const token = this.readToken(slot)
      if (token) {
        env[name] = token
      }
    }
    add(envs.openmetadata, OPENMETADATA_TOKEN_ENV, { kind: 'openmetadata' })
    for (const profile of state.openMetadata.profiles) {
      add(envs.openmetadata, openMetadataProfileTokenEnv(profile.name), {
        kind: 'openmetadata-profile',
        name: profile.name
      })
    }
    add(envs.engram, ENGRAM_CLOUD_TOKEN_ENV, { kind: 'engram-cloud' })
    if (state.engram.serverUrl) {
      envs.engram[ENGRAM_CLOUD_SERVER_ENV] = state.engram.serverUrl
    }
    this.envCache = envs
    return envs
  }

  /**
   * Env vars for agents MassOrca launches. With an agent, an app whose policy keeps that agent out
   * adds none of its vars; without one, every stored var is returned.
   */
  buildAgentEnv(agent?: MarketplaceAppAgent): Record<string, string> {
    const envs = this.readAppEnvs()
    const access = this.readState().access
    const env: Record<string, string> = {}
    for (const app of ENV_APPS) {
      if (agent !== undefined && !isMarketplaceAppAllowedForAgent(access[app], agent)) {
        continue
      }
      Object.assign(env, envs[app])
    }
    return env
  }
}

let defaultVault: MarketplaceVault | null = null

export function getMarketplaceVault(): MarketplaceVault {
  defaultVault ??= new MarketplaceVault()
  return defaultVault
}
