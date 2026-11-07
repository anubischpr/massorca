import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'
import {
  formatMarketplaceAccess,
  formatMarketplaceApp,
  formatMarketplaceApps
} from '../marketplace-format'
import {
  everyoneAccessPolicy,
  MARKETPLACE_ACCESS_MODES,
  MARKETPLACE_APP_AGENTS,
  MARKETPLACE_APP_IDS,
  type MarketplaceActionResult,
  type MarketplaceAppAgent,
  type MarketplaceAppId,
  type MarketplaceAppStatus
} from '../../shared/marketplace-apps'
import {
  MARKETPLACE_APPS_ADD_OPENMETADATA_PROFILE_METHOD,
  MARKETPLACE_APPS_CONNECT_METHOD,
  MARKETPLACE_APPS_DISCONNECT_METHOD,
  MARKETPLACE_APPS_LIST_METHOD,
  MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD,
  MARKETPLACE_APPS_SET_ENGRAM_SERVER_METHOD,
  MARKETPLACE_APPS_SET_OPENMETADATA_TOKEN_METHOD,
  readMarketplaceActionAnswer,
  readMarketplaceAppsListAnswer
} from '../../shared/rpc-contract/marketplace-apps-params'
import { callMarketplaceHost } from './marketplace-host-call'
import { readSecretInput } from './marketplace-secret-input'

const FAILURE_MESSAGES: Record<string, string> = {
  'invalid-input': 'The host refused the input.',
  'unreadable-config': "An agent's config file could not be read, so it was left unchanged.",
  'unsupported-shape': "An agent's config file has a shape MassOrca does not edit.",
  'outside-home': "An agent's settings file links outside its home, so MassOrca left it alone.",
  'vault-unavailable': "The host's credential vault is unavailable.",
  failed: 'The host could not finish the Marketplace action.'
}

function readAppId(ctx: HandlerContext): MarketplaceAppId {
  const value = getRequiredStringFlag(ctx.flags, 'app')
  const id = MARKETPLACE_APP_IDS.find((candidate) => candidate === value)
  if (!id) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Unknown app "${value}". Apps: ${MARKETPLACE_APP_IDS.join(', ')}`
    )
  }
  return id
}

async function listApps(ctx: HandlerContext): Promise<RuntimeRpcSuccess<MarketplaceAppStatus[]>> {
  const response = await callMarketplaceHost(ctx, MARKETPLACE_APPS_LIST_METHOD)
  const answer = readMarketplaceAppsListAnswer(response.result)
  if (!answer.ok) {
    throw new RuntimeClientError('runtime_error', FAILURE_MESSAGES.failed)
  }
  // Why: rebuilt from the contract's known fields, so nothing a host adds can reach stdout.
  return { ...response, result: answer.apps }
}

async function appStatus(
  ctx: HandlerContext,
  id: MarketplaceAppId
): Promise<RuntimeRpcSuccess<MarketplaceAppStatus>> {
  const response = await listApps(ctx)
  const app = response.result.find((candidate) => candidate.id === id)
  if (!app) {
    throw new RuntimeClientError('runtime_error', `The host did not report ${id}.`)
  }
  return { ...response, result: app }
}

async function runAction(
  ctx: HandlerContext,
  method: string,
  params: unknown
): Promise<RuntimeRpcSuccess<MarketplaceAppStatus>> {
  const response = await callMarketplaceHost(ctx, method, params)
  const answer: MarketplaceActionResult = readMarketplaceActionAnswer(response.result)
  if (!answer.ok) {
    const agent = answer.agent ? ` (agent: ${answer.agent})` : ''
    throw new RuntimeClientError(
      'runtime_error',
      `${FAILURE_MESSAGES[answer.reason] ?? FAILURE_MESSAGES.failed}${agent}`
    )
  }
  return { ...response, result: answer.status }
}

/** Rewrites every allowed agent's entries from what the host already stores; no token is sent. */
function repair(ctx: HandlerContext, app: MarketplaceAppStatus) {
  return runAction(ctx, MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD, {
    id: app.id,
    policy: app.access ?? everyoneAccessPolicy()
  })
}

async function connectOpenMetadata(
  ctx: HandlerContext,
  app: MarketplaceAppStatus,
  server: string | undefined,
  token: string | undefined
) {
  const profile = getOptionalStringFlag(ctx.flags, 'profile')
  if (profile !== undefined) {
    if (!server || !token) {
      throw new RuntimeClientError(
        'invalid_argument',
        'A profile needs --server and a token (--token-stdin or --token-env).'
      )
    }
    return runAction(ctx, MARKETPLACE_APPS_ADD_OPENMETADATA_PROFILE_METHOD, {
      name: profile,
      url: server,
      token
    })
  }
  if (!app.serverUrl || (server !== undefined && server !== app.serverUrl)) {
    if (!server || !token) {
      throw new RuntimeClientError(
        'invalid_argument',
        app.serverUrl
          ? 'A new server address needs its token (--token-stdin or --token-env).'
          : 'OpenMetadata is not set up on this host yet. Pass --server and a token (--token-stdin or --token-env).'
      )
    }
    return runAction(ctx, MARKETPLACE_APPS_CONNECT_METHOD, {
      id: 'openmetadata',
      url: server,
      token
    })
  }
  if (token !== undefined) {
    await runAction(ctx, MARKETPLACE_APPS_SET_OPENMETADATA_TOKEN_METHOD, { token })
  } else if (app.credential?.stored !== true) {
    throw new RuntimeClientError(
      'invalid_argument',
      'No OpenMetadata token is stored on this host. Pass one with --token-stdin or --token-env.'
    )
  }
  return repair(ctx, app)
}

async function connectEngram(
  ctx: HandlerContext,
  app: MarketplaceAppStatus,
  server: string | undefined,
  token: string | undefined
) {
  if (server !== undefined || token !== undefined) {
    const url = server ?? app.serverUrl
    if (!url) {
      throw new RuntimeClientError('invalid_argument', 'An Engram cloud token needs --server.')
    }
    await runAction(ctx, MARKETPLACE_APPS_SET_ENGRAM_SERVER_METHOD, {
      url,
      ...(token !== undefined ? { token } : {})
    })
  }
  return runAction(ctx, MARKETPLACE_APPS_CONNECT_METHOD, { id: 'engram' })
}

function readAgentPicks(ctx: HandlerContext): MarketplaceAppAgent[] {
  const list = getOptionalStringFlag(ctx.flags, 'agents') ?? ''
  return list
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const agent = MARKETPLACE_APP_AGENTS.find((candidate) => candidate === value)
      if (!agent) {
        throw new RuntimeClientError(
          'invalid_argument',
          `Unknown agent "${value}". Agents: ${MARKETPLACE_APP_AGENTS.join(', ')}`
        )
      }
      return agent
    })
}

export const MARKETPLACE_HANDLERS: Record<string, CommandHandler> = {
  'marketplace list': async (ctx) => {
    const response = await listApps(ctx)
    const only = getOptionalStringFlag(ctx.flags, 'app')
    const result = only ? response.result.filter((app) => app.id === only) : response.result
    printResult({ ...response, result }, ctx.json, formatMarketplaceApps)
  },
  'marketplace connect': async (ctx) => {
    const id = readAppId(ctx)
    const server = getOptionalStringFlag(ctx.flags, 'server')
    const token = await readSecretInput(ctx.flags, 'token')
    if (id === 'github') {
      if (server !== undefined || token !== undefined) {
        throw new RuntimeClientError('invalid_argument', 'GitHub takes no --server or token.')
      }
      printResult(
        await runAction(ctx, MARKETPLACE_APPS_CONNECT_METHOD, { id }),
        ctx.json,
        formatMarketplaceApp
      )
      return
    }
    const app = (await appStatus(ctx, id)).result
    const response =
      id === 'engram'
        ? await connectEngram(ctx, app, server, token)
        : await connectOpenMetadata(ctx, app, server, token)
    printResult(response, ctx.json, formatMarketplaceApp)
  },
  'marketplace disconnect': async (ctx) => {
    const id = readAppId(ctx)
    printResult(
      await runAction(ctx, MARKETPLACE_APPS_DISCONNECT_METHOD, { id }),
      ctx.json,
      formatMarketplaceApp
    )
  },
  'marketplace access': async (ctx) => {
    const id = readAppId(ctx)
    const status = await appStatus(ctx, id)
    const app = status.result
    const mode = getOptionalStringFlag(ctx.flags, 'mode')
    const agents = readAgentPicks(ctx)
    if (mode === undefined) {
      if (agents.length > 0) {
        throw new RuntimeClientError('invalid_argument', '--agents needs --mode only|except.')
      }
      printResult(status, ctx.json, formatMarketplaceAccess)
      return
    }
    const accessMode = MARKETPLACE_ACCESS_MODES.find((candidate) => candidate === mode)
    if (!accessMode) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Unknown --mode "${mode}". Modes: ${MARKETPLACE_ACCESS_MODES.join(', ')}`
      )
    }
    const current = app.access ?? everyoneAccessPolicy()
    // Why: only the agent half changes here; bot picks are left exactly as the host has them.
    const policy = {
      ...current,
      agents: { mode: accessMode, ids: accessMode === 'everyone' ? [] : agents }
    }
    printResult(
      await runAction(ctx, MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD, { id, policy }),
      ctx.json,
      formatMarketplaceAccess
    )
  }
}
