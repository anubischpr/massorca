import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import type { JiraConnectionStatus } from '../../shared/jira-types'
import type { LinearConnectionStatus } from '../../shared/linear/workspace-types'
import { callMarketplaceHost, callMarketplaceHostOptional } from './marketplace-host-call'
import { readSecretInput } from './marketplace-secret-input'
import { MARKETPLACE_SKILL_HANDLERS } from './marketplace-skills'

const SERVICE_IDS = ['gitlab', 'bitbucket', 'azure-devops', 'gitea', 'linear', 'jira'] as const
type ServiceId = (typeof SERVICE_IDS)[number]

export type MarketplaceServiceRow = {
  id: ServiceId
  name: string
  state: 'connected' | 'not-connected' | 'unknown'
  account: string | null
  detail?: string
}

const VAULT_SERVICES = ['gitlab', 'bitbucket', 'azure-devops', 'gitea'] as const
type VaultServiceId = (typeof VAULT_SERVICES)[number]

function isVaultService(id: ServiceId): id is VaultServiceId {
  return VAULT_SERVICES.some((service) => service === id)
}

// Why: a host that predates `marketplace.service.*` still needs a way, so the CLI names that route.
const NO_HOST_CONNECT: Record<VaultServiceId, string> = {
  gitlab: 'Run `glab auth login` on the host, then check `orca marketplace services list`.',
  bitbucket: 'Connect Bitbucket from Marketplace › Services in the desktop app for now.',
  'azure-devops': 'Connect Azure DevOps from Marketplace › Services in the desktop app for now.',
  gitea: 'Connect Gitea from Marketplace › Services in the desktop app for now.'
}

type TokenPreflight = { configured?: boolean; authenticated: boolean; account?: string | null }
type HostedPreflight = TokenPreflight & { baseUrl: string | null }

// Why: the fields of `preflight.check` read here; importing its main-process type drags main into the CLI build.
type PreflightStatus = {
  glab?: { installed: boolean; authenticated: boolean }
  bitbucket?: TokenPreflight
  azureDevOps?: HostedPreflight
  gitea?: HostedPreflight
}

function tokenRow(
  id: ServiceId,
  name: string,
  status: TokenPreflight | undefined,
  baseUrl?: string | null
): MarketplaceServiceRow {
  if (!status) {
    return { id, name, state: 'unknown', account: null, detail: 'host predates this check' }
  }
  const detail =
    status.configured === true && !status.authenticated ? 'configured, but sign-in failed' : baseUrl
  return {
    id,
    name,
    state: status.authenticated ? 'connected' : 'not-connected',
    account: status.account ?? null,
    ...(detail ? { detail } : {})
  }
}

function taskRow(
  id: ServiceId,
  name: string,
  status: LinearConnectionStatus | JiraConnectionStatus | null,
  detail: string | undefined
): MarketplaceServiceRow {
  if (!status) {
    return { id, name, state: 'unknown', account: null, detail: 'host predates this check' }
  }
  const viewer = status.viewer
  return {
    id,
    name,
    state: status.connected ? 'connected' : 'not-connected',
    account: viewer ? (viewer.email ?? viewer.displayName) : null,
    ...(status.credentialError
      ? { detail: 'stored token cannot be read' }
      : detail
        ? { detail }
        : {})
  }
}

/** Rebuilt field by field from each check, so no token or token path can reach stdout. */
export function marketplaceServiceRows(
  preflight: PreflightStatus | null,
  linear: LinearConnectionStatus | null,
  jira: JiraConnectionStatus | null
): MarketplaceServiceRow[] {
  const glab = preflight?.glab
  const jiraSite = jira?.sites?.find((site) => site.id === jira.activeSiteId)
  return [
    {
      ...tokenRow('gitlab', 'GitLab', glab),
      ...(glab && !glab.installed ? { detail: 'glab not installed' } : {})
    },
    tokenRow('bitbucket', 'Bitbucket', preflight?.bitbucket),
    tokenRow(
      'azure-devops',
      'Azure DevOps',
      preflight?.azureDevOps,
      preflight?.azureDevOps?.baseUrl
    ),
    tokenRow('gitea', 'Gitea', preflight?.gitea, preflight?.gitea?.baseUrl),
    taskRow('linear', 'Linear', linear, linear?.viewer?.organizationName),
    taskRow('jira', 'Jira', jira, jiraSite?.siteUrl)
  ]
}

function formatServiceRows(rows: readonly MarketplaceServiceRow[]): string {
  return rows
    .map((row) => {
      const state =
        row.state === 'connected'
          ? 'connected'
          : row.state === 'unknown'
            ? 'unknown'
            : 'not connected'
      const account = row.account ? ` as ${row.account}` : ''
      const detail = row.detail ? ` (${row.detail})` : ''
      return `${row.name}: ${state}${account}${detail}`
    })
    .join('\n')
}

function readServiceId(ctx: HandlerContext): ServiceId {
  const value = getRequiredStringFlag(ctx.flags, 'service')
  const id = SERVICE_IDS.find((candidate) => candidate === value)
  if (!id) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Unknown service "${value}". Services: ${SERVICE_IDS.join(', ')}`
    )
  }
  return id
}

async function serviceRows(ctx: HandlerContext) {
  const [preflight, linear, jira] = await Promise.all([
    callMarketplaceHostOptional<PreflightStatus>(ctx, 'preflight.check', {}),
    callMarketplaceHostOptional<LinearConnectionStatus>(ctx, 'linear.status'),
    callMarketplaceHostOptional<JiraConnectionStatus>(ctx, 'jira.status')
  ])
  const envelope = preflight ?? linear ?? jira
  if (!envelope) {
    throw new RuntimeClientError(
      'method_not_found',
      'This host answers none of the service checks.'
    )
  }
  const rows = marketplaceServiceRows(
    preflight?.result ?? null,
    linear?.result ?? null,
    jira?.result ?? null
  )
  return { ...envelope, result: rows }
}

/** `marketplace.service.*` answers `{ok:false, reason, message?}`; only those fields reach the error. */
function readVaultAnswer(result: unknown, action: string): void {
  if (typeof result !== 'object' || result === null || !('ok' in result) || result.ok !== false) {
    return
  }
  const reason = 'reason' in result && typeof result.reason === 'string' ? result.reason : 'failed'
  const message = 'message' in result && typeof result.message === 'string' ? result.message : ''
  throw new RuntimeClientError(
    'runtime_error',
    `The host could not ${action}: ${reason}${message ? ` (${message})` : ''}`
  )
}

async function callVaultService(
  ctx: HandlerContext,
  id: VaultServiceId,
  method: 'connect' | 'disconnect',
  params: Record<string, unknown>
): Promise<void> {
  const answer = await callMarketplaceHostOptional(ctx, `marketplace.service.${method}`, params)
  if (!answer) {
    throw new RuntimeClientError('method_not_found', NO_HOST_CONNECT[id])
  }
  readVaultAnswer(answer.result, method)
}

async function printServiceRow(ctx: HandlerContext, id: ServiceId): Promise<void> {
  const rows = await serviceRows(ctx)
  printResult(
    { ...rows, result: rows.result.filter((row) => row.id === id) },
    ctx.json,
    formatServiceRows
  )
}

function readConnectAnswer(result: unknown): void {
  if (typeof result === 'object' && result !== null && 'ok' in result && result.ok === false) {
    const error = 'error' in result && typeof result.error === 'string' ? result.error : 'failed'
    throw new RuntimeClientError('runtime_error', `The host could not connect: ${error}`)
  }
}

export const MARKETPLACE_SERVICE_HANDLERS: Record<string, CommandHandler> = {
  'marketplace services list': async (ctx) => {
    printResult(await serviceRows(ctx), ctx.json, formatServiceRows)
  },
  'marketplace services connect': async (ctx) => {
    const id = readServiceId(ctx)
    const token = await readSecretInput(ctx.flags, 'token')
    if (token === undefined) {
      throw new RuntimeClientError(
        'invalid_argument',
        `${id} needs a token: --token-stdin or --token-env <NAME>.`
      )
    }
    if (isVaultService(id)) {
      const baseUrl = getOptionalStringFlag(ctx.flags, 'site')
      const email = getOptionalStringFlag(ctx.flags, 'email')
      await callVaultService(ctx, id, 'connect', {
        service: id,
        token,
        ...(baseUrl ? { baseUrl } : {}),
        ...(email ? { email } : {})
      })
      await printServiceRow(ctx, id)
      return
    }
    const params =
      id === 'linear'
        ? { apiKey: token }
        : {
            siteUrl: getRequiredStringFlag(ctx.flags, 'site'),
            email: getOptionalStringFlag(ctx.flags, 'email'),
            apiToken: token,
            authType: getOptionalStringFlag(ctx.flags, 'auth-type')
          }
    readConnectAnswer((await callMarketplaceHost(ctx, `${id}.connect`, params)).result)
    await printServiceRow(ctx, id)
  },
  'marketplace services disconnect': async (ctx) => {
    const id = readServiceId(ctx)
    await (isVaultService(id)
      ? callVaultService(ctx, id, 'disconnect', { service: id })
      : callMarketplaceHost(ctx, `${id}.disconnect`, {}))
    await printServiceRow(ctx, id)
  },
  ...MARKETPLACE_SKILL_HANDLERS
}
