import {
  OPENMETADATA_TOKEN_ENV,
  openMetadataProfileTokenEnv,
  type MarketplaceActionResult,
  type MarketplaceAppId,
  type MarketplaceAppsApi,
  type MarketplaceAppStatus
} from '../../shared/marketplace-apps'
import type { McpEntryEdit } from './marketplace-agent-config'
import {
  parseAddProfileArgs,
  parseConnectArgs,
  parseDisconnectArgs,
  parseEngramServerArgs,
  parseRemoveProfileArgs,
  parseTokenArgs,
  profileEnvCollides
} from './marketplace-apps-args'
import { readAppStatuses, type MarketplaceStatusDeps } from './marketplace-apps-status'
import { runAppWrites, type AppWritePlan, type WrittenApp } from './marketplace-app-writes'
import {
  ENGRAM_ENTRY_NAME,
  OPENMETADATA_ENTRY_NAME,
  engramEntrySpec,
  openMetadataEntrySpec
} from './marketplace-entry-specs'
import type { MarketplaceState } from './marketplace-vault'

export type MarketplaceAppsServiceDeps = MarketplaceStatusDeps

const INVALID: MarketplaceActionResult = { ok: false, reason: 'invalid-input' }
const VAULT_UNAVAILABLE: MarketplaceActionResult = { ok: false, reason: 'vault-unavailable' }

/** Every entry MassOrca writes for one app, given what the state says about the apps' profiles. */
function setPlan(
  app: WrittenApp,
  state: MarketplaceState,
  instructions: 'add' | 'keep'
): AppWritePlan {
  return {
    app,
    instructions,
    entries: (agent, owned) => {
      if (app === 'engram') {
        return [
          {
            action: 'set',
            name: ENGRAM_ENTRY_NAME,
            owned: owned.has(ENGRAM_ENTRY_NAME),
            ...engramEntrySpec(agent)
          }
        ]
      }
      const { url, profiles } = state.openMetadata
      const entries: McpEntryEdit[] = []
      if (url) {
        entries.push({
          action: 'set',
          name: OPENMETADATA_ENTRY_NAME,
          owned: owned.has(OPENMETADATA_ENTRY_NAME),
          ...openMetadataEntrySpec(agent, url, OPENMETADATA_TOKEN_ENV)
        })
      }
      for (const profile of profiles) {
        entries.push({
          action: 'set',
          name: profile.name,
          owned: owned.has(profile.name),
          ...openMetadataEntrySpec(agent, profile.url, openMetadataProfileTokenEnv(profile.name))
        })
      }
      return entries
    }
  }
}

function removePlan(
  app: WrittenApp,
  names: (agentOwned: ReadonlySet<string>) => string[]
): AppWritePlan {
  return {
    app,
    instructions: 'remove',
    entries: (_agent, owned) => names(owned).map((name) => ({ action: 'remove', name }))
  }
}

/** The API with every argument untrusted: each method parses its own input before using it. */
export type MarketplaceAppsService = {
  listApps: () => Promise<MarketplaceAppStatus[]>
} & Record<
  Exclude<keyof MarketplaceAppsApi, 'listApps' | 'remoteVault'>,
  (args: unknown) => Promise<MarketplaceActionResult>
>

export function createMarketplaceAppsService(
  deps: MarketplaceAppsServiceDeps
): MarketplaceAppsService {
  const { vault, paths } = deps
  // Why: connect, disconnect and profile edits all read-modify-write the same files and state.
  let queue: Promise<unknown> = Promise.resolve()
  const serialized = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  const statusOf = async (id: MarketplaceAppId): Promise<MarketplaceActionResult> => {
    const status = (await readAppStatuses(deps)).find((candidate) => candidate.id === id)
    return status ? { ok: true, status } : { ok: false, reason: 'failed' }
  }

  const guarded = (
    task: () => Promise<MarketplaceActionResult>
  ): Promise<MarketplaceActionResult> =>
    serialized(async () => {
      try {
        return await task()
      } catch {
        return { ok: false, reason: 'failed' }
      }
    })

  const finish = (
    state: MarketplaceState,
    id: MarketplaceAppId,
    failure: ReturnType<typeof runAppWrites>
  ): Promise<MarketplaceActionResult> => {
    vault.writeState(state)
    return failure ? Promise.resolve({ ok: false, ...failure }) : statusOf(id)
  }

  return {
    listApps: () => readAppStatuses(deps),

    connect: (rawArgs) =>
      guarded(async () => {
        const args = parseConnectArgs(rawArgs)
        if (!args) {
          return INVALID
        }
        const state = vault.readState()
        if (args.id === 'github') {
          state.github.hidden = false
          vault.writeState(state)
          return statusOf('github')
        }
        if (args.id === 'engram') {
          state.engram.connected = true
          return finish(
            state,
            'engram',
            runAppWrites(state, setPlan('engram', state, 'add'), paths)
          )
        }
        if (!vault.writeToken({ kind: 'openmetadata' }, args.token)) {
          return VAULT_UNAVAILABLE
        }
        state.openMetadata.url = args.url
        return finish(
          state,
          'openmetadata',
          runAppWrites(state, setPlan('openmetadata', state, 'add'), paths)
        )
      }),

    disconnect: (rawArgs) =>
      guarded(async () => {
        const args = parseDisconnectArgs(rawArgs)
        if (!args) {
          return INVALID
        }
        const state = vault.readState()
        if (args.id === 'github') {
          state.github.hidden = true
          vault.writeState(state)
          return statusOf('github')
        }
        const app: WrittenApp = args.id
        const failure = runAppWrites(
          state,
          removePlan(app, (owned) => [...owned]),
          paths
        )
        if (app === 'engram') {
          vault.deleteToken({ kind: 'engram-cloud' })
          state.engram = { connected: false, serverUrl: null }
        } else {
          vault.deleteToken({ kind: 'openmetadata' })
          state.openMetadata.profiles.forEach((profile) =>
            vault.deleteToken({ kind: 'openmetadata-profile', name: profile.name })
          )
          state.openMetadata = { url: null, profiles: [] }
        }
        const nothingLeft =
          Object.keys(state.written.engram).length === 0 &&
          Object.keys(state.written.openmetadata).length === 0 &&
          !state.engram.connected &&
          state.openMetadata.url === null &&
          state.openMetadata.profiles.length === 0 &&
          !state.github.hidden
        if (nothingLeft) {
          vault.clearState()
        } else {
          vault.writeState(state)
        }
        return failure ? { ok: false, ...failure } : statusOf(args.id)
      }),

    setOpenMetadataToken: (rawArgs) =>
      guarded(async () => {
        const args = parseTokenArgs(rawArgs)
        if (!args || vault.readState().openMetadata.url === null) {
          return INVALID
        }
        return vault.writeToken({ kind: 'openmetadata' }, args.token)
          ? statusOf('openmetadata')
          : VAULT_UNAVAILABLE
      }),

    addOpenMetadataProfile: (rawArgs) =>
      guarded(async () => {
        const args = parseAddProfileArgs(rawArgs)
        const state = vault.readState()
        const names = state.openMetadata.profiles.map((profile) => profile.name)
        if (!args || profileEnvCollides(args.name, names)) {
          return INVALID
        }
        if (!vault.writeToken({ kind: 'openmetadata-profile', name: args.name }, args.token)) {
          return VAULT_UNAVAILABLE
        }
        const profiles = state.openMetadata.profiles.filter((profile) => profile.name !== args.name)
        state.openMetadata.profiles = [...profiles, { name: args.name, url: args.url }]
        return finish(
          state,
          'openmetadata',
          runAppWrites(state, setPlan('openmetadata', state, 'keep'), paths)
        )
      }),

    removeOpenMetadataProfile: (rawArgs) =>
      guarded(async () => {
        const args = parseRemoveProfileArgs(rawArgs)
        const state = vault.readState()
        if (!args || !state.openMetadata.profiles.some((profile) => profile.name === args.name)) {
          return INVALID
        }
        const plan: AppWritePlan = {
          app: 'openmetadata',
          instructions: 'keep',
          entries: (_agent, owned) =>
            owned.has(args.name) ? [{ action: 'remove', name: args.name }] : []
        }
        const failure = runAppWrites(state, plan, paths)
        vault.deleteToken({ kind: 'openmetadata-profile', name: args.name })
        state.openMetadata.profiles = state.openMetadata.profiles.filter(
          (profile) => profile.name !== args.name
        )
        return finish(state, 'openmetadata', failure)
      }),

    setEngramServer: (rawArgs) =>
      guarded(async () => {
        const args = parseEngramServerArgs(rawArgs)
        if (!args) {
          return INVALID
        }
        const state = vault.readState()
        if (args.url === null) {
          vault.deleteToken({ kind: 'engram-cloud' })
        } else if (args.token && !vault.writeToken({ kind: 'engram-cloud' }, args.token)) {
          return VAULT_UNAVAILABLE
        }
        state.engram.serverUrl = args.url
        vault.writeState(state)
        return statusOf('engram')
      })
  }
}
