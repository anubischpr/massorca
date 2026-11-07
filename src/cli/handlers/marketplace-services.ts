import { randomUUID } from 'node:crypto'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import type { JiraConnectionStatus } from '../../shared/jira-types'
import type { LinearConnectionStatus } from '../../shared/linear/workspace-types'
import type { ManagedSkillInstall, SkillInstallResult } from '../../shared/skill-install-contract'
import { callMarketplaceHost, callMarketplaceHostOptional } from './marketplace-host-call'
import { readSecretInput } from './marketplace-secret-input'

const SERVICE_IDS = ['gitlab', 'bitbucket', 'azure-devops', 'gitea', 'linear', 'jira'] as const
type ServiceId = (typeof SERVICE_IDS)[number]

export type MarketplaceServiceRow = {
  id: ServiceId
  name: string
  state: 'connected' | 'not-connected' | 'unknown'
  account: string | null
  detail?: string
}

// Why: these have no host RPC to connect yet, so the CLI names the host-side route instead.
const NO_HOST_CONNECT: Partial<Record<ServiceId, string>> = {
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

function readConnectAnswer(result: unknown): void {
  if (typeof result === 'object' && result !== null && 'ok' in result && result.ok === false) {
    const error = 'error' in result && typeof result.error === 'string' ? result.error : 'failed'
    throw new RuntimeClientError('runtime_error', `The host could not connect: ${error}`)
  }
}

function formatSkillInstalls(installs: readonly ManagedSkillInstall[]): string {
  const global = installs.filter((install) => install.scope === 'global')
  if (global.length === 0) {
    return 'No Marketplace skills installed on this host.'
  }
  return global
    .map((install) => {
      const where =
        install.destination.scope === 'global' ? install.destination.executionTarget : undefined
      const target =
        where && where.kind !== 'host'
          ? ` [${where.kind}${where.kind === 'wsl' ? ` ${where.distro}` : ''}]`
          : ''
      const agents = install.providers?.length
        ? install.providers.join(', ')
        : 'every detected agent'
      return `${install.name}${target}: ${install.state}; agents: ${agents}`
    })
    .join('\n')
}

export const MARKETPLACE_SERVICE_HANDLERS: Record<string, CommandHandler> = {
  'marketplace services list': async (ctx) => {
    printResult(await serviceRows(ctx), ctx.json, formatServiceRows)
  },
  'marketplace services connect': async (ctx) => {
    const id = readServiceId(ctx)
    const hint = NO_HOST_CONNECT[id]
    if (hint) {
      throw new RuntimeClientError('invalid_argument', hint)
    }
    const token = await readSecretInput(ctx.flags, 'token')
    if (token === undefined) {
      throw new RuntimeClientError(
        'invalid_argument',
        `${id === 'linear' ? 'Linear' : 'Jira'} needs a token: --token-stdin or --token-env <NAME>.`
      )
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
    const rows = await serviceRows(ctx)
    printResult(
      { ...rows, result: rows.result.filter((row) => row.id === id) },
      ctx.json,
      formatServiceRows
    )
  },
  'marketplace services disconnect': async (ctx) => {
    const id = readServiceId(ctx)
    if (id !== 'linear' && id !== 'jira') {
      throw new RuntimeClientError('invalid_argument', NO_HOST_CONNECT[id] ?? 'Not supported.')
    }
    await callMarketplaceHost(ctx, `${id}.disconnect`, {})
    const rows = await serviceRows(ctx)
    printResult(
      { ...rows, result: rows.result.filter((row) => row.id === id) },
      ctx.json,
      formatServiceRows
    )
  },
  'marketplace skills list': async (ctx) => {
    const response = await callMarketplaceHost<ManagedSkillInstall[]>(
      ctx,
      'skills.listManagedInstalls'
    )
    const installs = Array.isArray(response.result) ? response.result : []
    printResult({ ...response, result: installs }, ctx.json, formatSkillInstalls)
  },
  'marketplace skills uninstall': async (ctx) => {
    const name = getRequiredStringFlag(ctx.flags, 'name')
    const response = await callMarketplaceHost<SkillInstallResult>(ctx, 'skills.removeInstall', {
      operationId: randomUUID(),
      name,
      destination: { scope: 'global' }
    })
    if (response.result.status !== 'removed') {
      process.exitCode = 1
    }
    printResult(response, ctx.json, (value) => `${value.name}: ${value.status}`)
  }
}
