import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { parseHostFlag, parseWslHostFlag } from '../execution-host-flag'
import { RuntimeClientError } from '../runtime-client'
import { callMarketplaceHost } from './marketplace-host-call'

type GitHubAccount = {
  host: string
  user: string
  active: boolean
  envToken: 'GITHUB_TOKEN' | 'GH_TOKEN' | null
  source: 'env' | 'keyring'
  scopes: string[]
}
type GitHubInventory = {
  capability: 'supported' | 'unsupported' | 'unknown'
  accounts: GitHubAccount[]
}
type GitHubChange = { ok: true } | { ok: false; reason: string }

const CHANGE_REASONS: Record<string, string> = {
  invalid_account: 'gh has no such account on that host',
  unsupported: 'the gh on that host is too old to switch or remove accounts',
  failed: 'gh failed'
}

/** These methods act on the connected host; index.ts already pointed it at runtime:<id>. */
function refuseDesktopOnlyHost(ctx: HandlerContext): string {
  if (parseWslHostFlag(ctx.flags) !== null || parseHostFlag(ctx.flags)?.kind === 'ssh') {
    throw new RuntimeClientError(
      'invalid_argument',
      'GitHub accounts on a WSL distro or an SSH host are only reachable from the desktop app, not from the CLI yet.'
    )
  }
  const host = ctx.flags.get('host')
  return typeof host === 'string' && host !== 'local' ? host : 'this host'
}

function hostUnreachable(error: unknown, hostLabel: string): never {
  if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
    throw new RuntimeClientError('method_not_found', `Update MassOrca on ${hostLabel} first.`)
  }
  throw error
}

export function formatGitHubAccounts(inventory: GitHubInventory): string {
  if (inventory.accounts.length === 0) {
    return 'No GitHub accounts signed in to gh on this host.'
  }
  const lines = inventory.accounts.map((account) => {
    const from = account.envToken ? `env ${account.envToken}` : account.source
    const scopes = account.scopes.length ? `; scopes: ${account.scopes.join(', ')}` : ''
    return `${account.active ? '*' : ' '} ${account.user} @ ${account.host} (${from}${scopes})`
  })
  if (inventory.capability !== 'supported') {
    lines.push(`Account switching: ${inventory.capability} with this host's gh.`)
  }
  return lines.join('\n')
}

function changeHandler(method: string, verb: 'switch' | 'remove', done: string): CommandHandler {
  return async (ctx) => {
    const hostLabel = refuseDesktopOnlyHost(ctx)
    const user = getRequiredStringFlag(ctx.flags, 'user')
    const githubHost = getOptionalStringFlag(ctx.flags, 'github-host') ?? 'github.com'
    if (verb === 'remove' && ctx.flags.get('yes') !== true) {
      throw new RuntimeClientError(
        'confirmation_required',
        `Removing ${user} signs it out of gh on ${hostLabel}. Re-run with --yes to confirm.`
      )
    }
    const response = await callMarketplaceHost<GitHubChange>(ctx, method, {
      host: githubHost,
      user
    }).catch((error: unknown) => hostUnreachable(error, hostLabel))
    if (!response.result.ok) {
      process.exitCode = 1
    }
    printResult(response, ctx.json, (value) =>
      value.ok
        ? `${user} @ ${githubHost}: ${done}`
        : `${user} @ ${githubHost}: could not ${verb} (${value.reason}: ${CHANGE_REASONS[value.reason] ?? 'unknown'})`
    )
  }
}

export const MARKETPLACE_GITHUB_ACCOUNT_HANDLERS: Record<string, CommandHandler> = {
  'marketplace github accounts list': async (ctx) => {
    const hostLabel = refuseDesktopOnlyHost(ctx)
    const response = await callMarketplaceHost<GitHubInventory>(
      ctx,
      'github.listHostBindableAccounts',
      { refreshCapability: true }
    ).catch((error: unknown) => hostUnreachable(error, hostLabel))
    printResult(response, ctx.json, formatGitHubAccounts)
  },
  'marketplace github accounts switch': changeHandler(
    'github.switchActiveAccount',
    'switch',
    'now the active account'
  ),
  'marketplace github accounts rm': changeHandler('github.removeAccount', 'remove', 'removed')
}
