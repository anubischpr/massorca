import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAzureDevOpsAuthConfig } from '../azure-devops/azure-devops-api-request'
import { getGiteaAuthConfig } from '../gitea/client'
import { makeTempHome } from './marketplace-apps-test-fixtures'
import {
  connectMarketplaceService,
  disconnectMarketplaceService,
  readMarketplaceServices,
  type MarketplaceServicesDeps
} from './marketplace-services'
import { storedServiceCredentials } from './marketplace-service-credentials'
import { MarketplaceVault } from './marketplace-vault'

const bitbucket = vi.hoisted(() => ({
  connectBitbucket: vi.fn(),
  disconnectBitbucket: vi.fn(),
  getBitbucketConnectionStatus: vi.fn()
}))
vi.mock('../bitbucket/credential-connection', () => bitbucket)

const TOKEN = 'fake-token-SECRET-123'
const ENV_KEYS = [
  'ORCA_AZURE_DEVOPS_TOKEN',
  'ORCA_AZURE_DEVOPS_PAT',
  'ORCA_AZURE_DEVOPS_ACCESS_TOKEN',
  'ORCA_AZURE_DEVOPS_API_BASE_URL',
  'ORCA_GITEA_TOKEN',
  'ORCA_GITEA_API_BASE_URL'
]
let home: string
let vault: MarketplaceVault
let deps: MarketplaceServicesDeps
const originalVault = storedServiceCredentials.vault
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

function entry(
  result: Awaited<ReturnType<typeof readMarketplaceServices>>,
  service: string
): Record<string, unknown> | undefined {
  if (!result.ok) {
    throw new Error('expected a status')
  }
  return result.status.services.find((candidate) => candidate.service === service)
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
  home = makeTempHome()
  vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'srv2056164'
  })
  storedServiceCredentials.vault = () => vault
  deps = {
    glabStatus: vi.fn(async () => ({ installed: true, authenticated: false })),
    glabLogin: vi.fn(async () => 'ok' as const),
    forgetCachedChecks: vi.fn()
  }
  bitbucket.getBitbucketConnectionStatus.mockReturnValue({
    configured: false,
    source: 'none',
    account: null,
    authMode: null,
    email: null,
    baseUrl: null
  })
  bitbucket.connectBitbucket.mockResolvedValue({ ok: true, account: 'ana' })
})

afterEach(() => {
  storedServiceCredentials.vault = originalVault
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  rmSync(home, { recursive: true, force: true })
  vi.clearAllMocks()
})

describe('marketplace services', () => {
  it('reports every service as not set on a fresh host', async () => {
    const result = await readMarketplaceServices(vault, deps)
    expect(result).toMatchObject({
      ok: true,
      status: { hostLabel: 'srv2056164', store: 'key-file' }
    })
    expect(entry(result, 'gitlab')).toEqual({
      service: 'gitlab',
      source: 'none',
      cliInstalled: true
    })
    expect(entry(result, 'azure-devops')).toEqual({ service: 'azure-devops', source: 'none' })
    expect(entry(result, 'gitea')).toEqual({ service: 'gitea', source: 'none' })
    expect(entry(result, 'bitbucket')).toEqual({ service: 'bitbucket', source: 'none' })
  })

  it.each(['azure-devops', 'gitea'] as const)(
    'stores a %s token and address in the vault and reports it connected',
    async (service) => {
      const result = await connectMarketplaceService(
        vault,
        { service, token: TOKEN, baseUrl: 'https://git.example.com/org' },
        deps
      )
      expect(entry(result, service)).toMatchObject({
        service,
        source: 'stored',
        baseUrl: 'https://git.example.com/org',
        updatedAt: expect.any(Number)
      })
      expect(vault.readToken({ kind: 'service-token', service })).toBe(TOKEN)
      expect(JSON.stringify(result)).not.toContain(TOKEN)
      expect(deps.forgetCachedChecks).toHaveBeenCalledTimes(1)
    }
  )

  it('clears the token and address on disconnect', async () => {
    await connectMarketplaceService(
      vault,
      { service: 'gitea', token: TOKEN, baseUrl: 'https://git.example.com' },
      deps
    )
    const result = await disconnectMarketplaceService(vault, { service: 'gitea' }, deps)
    expect(entry(result, 'gitea')).toEqual({ service: 'gitea', source: 'none' })
    expect(vault.readToken({ kind: 'service-token', service: 'gitea' })).toBeNull()
    expect(vault.readToken({ kind: 'service-url', service: 'gitea' })).toBeNull()
  })

  it('refuses a bad token or address without writing anything', async () => {
    expect(await connectMarketplaceService(vault, { service: 'gitea', token: '  ' }, deps)).toEqual(
      {
        ok: false,
        reason: 'invalid-input'
      }
    )
    expect(
      await connectMarketplaceService(
        vault,
        { service: 'gitea', token: TOKEN, baseUrl: 'not a url' },
        deps
      )
    ).toEqual({ ok: false, reason: 'invalid-input' })
    expect(vault.hasToken({ kind: 'service-token', service: 'gitea' })).toBe(false)
  })

  it('reports a token that only the environment holds as set up outside MassOrca', async () => {
    process.env.ORCA_GITEA_TOKEN = 'env-token'
    const result = await readMarketplaceServices(vault, deps)
    expect(entry(result, 'gitea')).toEqual({ service: 'gitea', source: 'external' })
  })

  it('signs GitLab in through the CLI with the token and the server host', async () => {
    const result = await connectMarketplaceService(
      vault,
      { service: 'gitlab', token: TOKEN, baseUrl: 'https://gitlab.example.com' },
      deps
    )
    expect(deps.glabLogin).toHaveBeenCalledWith(TOKEN, 'gitlab.example.com')
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(vault.isEmpty()).toBe(true)
  })

  it('says GitLab is not available when its CLI is missing, and never offers a disconnect', async () => {
    deps.glabLogin = vi.fn(async () => 'not-installed' as const)
    expect(
      await connectMarketplaceService(vault, { service: 'gitlab', token: TOKEN }, deps)
    ).toEqual({
      ok: false,
      reason: 'unavailable-on-host'
    })
    expect(await disconnectMarketplaceService(vault, { service: 'gitlab' }, deps)).toEqual({
      ok: false,
      reason: 'unavailable-on-host'
    })
  })

  it('connects Bitbucket with an email as an API token and without one as an access token', async () => {
    await connectMarketplaceService(
      vault,
      { service: 'bitbucket', token: TOKEN, email: 'ana@example.com' },
      deps
    )
    expect(bitbucket.connectBitbucket).toHaveBeenLastCalledWith({
      authMode: 'basic',
      email: 'ana@example.com',
      apiToken: TOKEN,
      baseUrl: undefined
    })
    await connectMarketplaceService(vault, { service: 'bitbucket', token: TOKEN }, deps)
    expect(bitbucket.connectBitbucket).toHaveBeenLastCalledWith({
      authMode: 'token',
      accessToken: TOKEN,
      baseUrl: undefined
    })
  })

  it("passes Bitbucket's refusal on as a sentence without the token", async () => {
    bitbucket.connectBitbucket.mockResolvedValue({
      ok: false,
      error: 'Bitbucket rejected these credentials.'
    })
    const result = await connectMarketplaceService(
      vault,
      { service: 'bitbucket', token: TOKEN },
      deps
    )
    expect(result).toEqual({
      ok: false,
      reason: 'rejected',
      message: 'Bitbucket rejected these credentials.'
    })
  })
})

describe('source-control readers use the stored credential first', () => {
  it('Azure DevOps prefers the saved token and address over the environment', async () => {
    process.env.ORCA_AZURE_DEVOPS_TOKEN = 'env-pat'
    process.env.ORCA_AZURE_DEVOPS_ACCESS_TOKEN = 'env-bearer'
    process.env.ORCA_AZURE_DEVOPS_API_BASE_URL = 'https://env.example.com'
    await connectMarketplaceService(
      vault,
      { service: 'azure-devops', token: TOKEN, baseUrl: 'https://dev.azure.com/acme' },
      deps
    )
    expect(getAzureDevOpsAuthConfig()).toMatchObject({
      pat: TOKEN,
      accessToken: null,
      apiBaseUrl: 'https://dev.azure.com/acme'
    })
  })

  it('Azure DevOps still honors the environment when nothing is saved', () => {
    process.env.ORCA_AZURE_DEVOPS_TOKEN = 'env-pat'
    process.env.ORCA_AZURE_DEVOPS_ACCESS_TOKEN = 'env-bearer'
    process.env.ORCA_AZURE_DEVOPS_API_BASE_URL = 'https://env.example.com'
    expect(getAzureDevOpsAuthConfig()).toMatchObject({
      pat: 'env-pat',
      accessToken: 'env-bearer',
      apiBaseUrl: 'https://env.example.com'
    })
  })

  it('Gitea prefers the saved token and address, then falls back to the environment', async () => {
    process.env.ORCA_GITEA_TOKEN = 'env-token'
    process.env.ORCA_GITEA_API_BASE_URL = 'https://env.example.com'
    expect(getGiteaAuthConfig()).toEqual({
      token: 'env-token',
      apiBaseUrl: 'https://env.example.com/api/v1'
    })
    await connectMarketplaceService(
      vault,
      { service: 'gitea', token: TOKEN, baseUrl: 'https://git.example.com' },
      deps
    )
    expect(getGiteaAuthConfig()).toEqual({
      token: TOKEN,
      apiBaseUrl: 'https://git.example.com/api/v1'
    })
  })
})
