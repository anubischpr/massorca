import type {
  MarketplaceServiceId,
  MarketplaceServiceStatus,
  MarketplaceServicesResult
} from '../../shared/marketplace-services'
import {
  MarketplaceServiceConnect,
  MarketplaceServiceDisconnect
} from '../../shared/rpc-contract/marketplace-service-params'
import {
  azureDevOpsTokenConfigured,
  getAzureDevOpsAuthConfig
} from '../azure-devops/azure-devops-api-request'
import {
  connectBitbucket,
  disconnectBitbucket,
  getBitbucketConnectionStatus
} from '../bitbucket/credential-connection'
import { getGiteaAuthConfig } from '../gitea/client'
import { _resetPreflightCache, runPreflightCheck } from '../preflight/agent-detection'
import { parseServerUrl, parseToken } from './marketplace-apps-args'
import {
  clearStoredServiceCredential,
  writeStoredServiceCredential
} from './marketplace-service-credentials'
import { glabLoginWithToken, type GlabLoginOutcome } from './marketplace-glab-login'
import type { MarketplaceVault, VaultTokenService } from './marketplace-vault'

/** The parts that touch other programs or the network; tests replace them. */
export type MarketplaceServicesDeps = {
  glabStatus: () => Promise<{ installed: boolean; authenticated: boolean }>
  glabLogin: (token: string, host: string | null) => Promise<GlabLoginOutcome>
  forgetCachedChecks: () => void
}

export const defaultMarketplaceServicesDeps: MarketplaceServicesDeps = {
  glabStatus: async () =>
    (await runPreflightCheck()).glab ?? { installed: false, authenticated: false },
  glabLogin: glabLoginWithToken,
  forgetCachedChecks: _resetPreflightCache
}

function vaultService(service: MarketplaceServiceId): VaultTokenService | null {
  return service === 'azure-devops' || service === 'gitea' ? service : null
}

function vaultServiceStatus(
  vault: MarketplaceVault,
  service: VaultTokenService
): MarketplaceServiceStatus {
  const stored = vault.credentialStatus({ kind: 'service-token', service })
  if (stored.stored) {
    const baseUrl = vault.readToken({ kind: 'service-url', service })
    return {
      service,
      source: 'stored',
      ...(stored.updatedAt === undefined ? {} : { updatedAt: stored.updatedAt }),
      ...(baseUrl ? { baseUrl } : {})
    }
  }
  const external =
    service === 'gitea'
      ? getGiteaAuthConfig().token !== null
      : azureDevOpsTokenConfigured(getAzureDevOpsAuthConfig())
  return { service, source: external ? 'external' : 'none' }
}

function bitbucketStatus(): MarketplaceServiceStatus {
  const connection = getBitbucketConnectionStatus()
  if (connection.source === 'none') {
    return { service: 'bitbucket', source: 'none' }
  }
  return {
    service: 'bitbucket',
    source: connection.source === 'stored' ? 'stored' : 'external',
    ...(connection.account ? { account: connection.account } : {}),
    ...(connection.baseUrl ? { baseUrl: connection.baseUrl } : {}),
    ...(connection.credentialProtection === undefined
      ? {}
      : { credentialProtection: connection.credentialProtection })
  }
}

/** Every service as this host reports it: set or not, where it comes from, never a token. */
export async function readMarketplaceServices(
  vault: MarketplaceVault,
  deps: MarketplaceServicesDeps = defaultMarketplaceServicesDeps
): Promise<MarketplaceServicesResult> {
  let glab: Awaited<ReturnType<MarketplaceServicesDeps['glabStatus']>>
  try {
    glab = await deps.glabStatus()
  } catch {
    glab = { installed: false, authenticated: false }
  }
  const location = vault.location()
  return {
    ok: true,
    status: {
      hostLabel: location.hostLabel,
      store: location.store,
      services: [
        {
          service: 'gitlab',
          source: glab.authenticated ? 'external' : 'none',
          cliInstalled: glab.installed
        },
        bitbucketStatus(),
        vaultServiceStatus(vault, 'azure-devops'),
        vaultServiceStatus(vault, 'gitea')
      ]
    }
  }
}

/** A GitLab address as a host name, or null for the default; `undefined` when it is not an address. */
function gitlabHost(baseUrl: string | undefined): string | null | undefined {
  if (baseUrl === undefined) {
    return null
  }
  const url = parseServerUrl(baseUrl)
  return url ? new URL(url).host : undefined
}

/** Saves or signs in. The arguments are untrusted; neither the result nor a log carries the token. */
export async function connectMarketplaceService(
  vault: MarketplaceVault,
  rawArgs: unknown,
  deps: MarketplaceServicesDeps = defaultMarketplaceServicesDeps
): Promise<MarketplaceServicesResult> {
  const parsed = MarketplaceServiceConnect.safeParse(rawArgs)
  const token = parsed.success ? parseToken(parsed.data.token) : null
  if (!parsed.success || !token) {
    return { ok: false, reason: 'invalid-input' }
  }
  const { service, baseUrl, email } = parsed.data
  const address = baseUrl === undefined ? undefined : parseServerUrl(baseUrl)
  if (baseUrl !== undefined && !address) {
    return { ok: false, reason: 'invalid-input' }
  }
  const stored = vaultService(service)
  if (stored) {
    if (!writeStoredServiceCredential(vault, stored, { token, baseUrl: address ?? undefined })) {
      return { ok: false, reason: 'vault-unavailable' }
    }
  } else if (service === 'bitbucket') {
    const result = await connectBitbucket(
      email
        ? { authMode: 'basic', email, apiToken: token, baseUrl: address }
        : { authMode: 'token', accessToken: token, baseUrl: address }
    )
    if (!result.ok) {
      return { ok: false, reason: 'rejected', message: result.error }
    }
  } else {
    const host = gitlabHost(address ?? undefined)
    if (host === undefined) {
      return { ok: false, reason: 'invalid-input' }
    }
    const outcome = await deps.glabLogin(token, host)
    if (outcome !== 'ok') {
      return {
        ok: false,
        reason: outcome === 'not-installed' ? 'unavailable-on-host' : outcome
      }
    }
  }
  deps.forgetCachedChecks()
  return readMarketplaceServices(vault, deps)
}

/** Deletes what MassOrca saved for a service on this host; the answer is the new status. */
export async function disconnectMarketplaceService(
  vault: MarketplaceVault,
  rawArgs: unknown,
  deps: MarketplaceServicesDeps = defaultMarketplaceServicesDeps
): Promise<MarketplaceServicesResult> {
  const parsed = MarketplaceServiceDisconnect.safeParse(rawArgs)
  if (!parsed.success) {
    return { ok: false, reason: 'invalid-input' }
  }
  const { service } = parsed.data
  const stored = vaultService(service)
  if (stored) {
    clearStoredServiceCredential(vault, stored)
  } else if (service === 'bitbucket') {
    disconnectBitbucket()
  } else {
    // Why: the GitLab program owns its accounts, so MassOrca has nothing of its own to delete.
    return { ok: false, reason: 'unavailable-on-host' }
  }
  deps.forgetCachedChecks()
  return readMarketplaceServices(vault, deps)
}
