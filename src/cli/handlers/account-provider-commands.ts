import { randomUUID } from 'node:crypto'
import type { HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'
import { buildCodexResetCreditExpectedScope } from '../../shared/codex-reset-credit-scope'
import type { AntigravityAccountState } from '../../shared/antigravity-account-types'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../shared/managed-account-types'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { formatAccountsBlock } from './account-list-format'
import { getWslAccountTarget } from './account-wsl-location'

export type ProviderAccountAgent = 'claude' | 'codex' | 'antigravity'

type AccountTarget = { runtime: 'host'; wslDistro: null } | { runtime: 'wsl'; wslDistro: string }

type CodexResetResult = { outcome?: unknown; status?: string; reason?: string }

export function isProviderAccountAgent(value: unknown): value is ProviderAccountAgent {
  return value === 'claude' || value === 'codex' || value === 'antigravity'
}

/** `--target host|wsl:<distro>`, else the WSL distro the CLI was started in, else undefined. */
function readTarget(ctx: HandlerContext): AccountTarget | undefined {
  const raw = getOptionalStringFlag(ctx.flags, 'target')
  if (raw === 'host') {
    return { runtime: 'host', wslDistro: null }
  }
  if (raw !== undefined) {
    const distro = raw.startsWith('wsl:') ? raw.slice(4).trim() : ''
    if (!distro) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Invalid --target "${raw}". Use host or wsl:<distro>.`
      )
    }
    return { runtime: 'wsl', wslDistro: distro }
  }
  return getWslAccountTarget(ctx.cwd) ?? undefined
}

// Why: the Antigravity host methods take a bare `host` target with no distro key.
function antigravityTarget(ctx: HandlerContext): { runtime: 'host' } | AccountTarget {
  const target = readTarget(ctx)
  return !target || target.runtime === 'host' ? { runtime: 'host' } : target
}

function formatAntigravityAccounts(state: AntigravityAccountState): string {
  const rows = state.accounts.map(
    (account) =>
      `  ${account.id}  ${account.email ?? account.subject ?? 'unknown'}${
        account.id === state.activeAccountId ? ' (active)' : ''
      }`
  )
  const current = state.currentAccount
    ? [`Signed in now: ${state.currentAccount.email ?? state.currentAccount.subject ?? 'unknown'}`]
    : []
  const head =
    rows.length === 0
      ? 'No managed Antigravity accounts.'
      : `Managed Antigravity accounts (${rows.length}):\n${rows.join('\n')}`
  return [head, ...current].join('\n')
}

export async function listAntigravityAccounts(ctx: HandlerContext): Promise<void> {
  const result = await ctx.client.call<AntigravityAccountState>(
    'accounts.antigravityList',
    antigravityTarget(ctx)
  )
  printResult(result, ctx.json, formatAntigravityAccounts)
}

export async function addAntigravityAccount(ctx: HandlerContext): Promise<void> {
  const result = await ctx.client.call<AntigravityAccountState>(
    'accounts.antigravityAddCurrent',
    antigravityTarget(ctx)
  )
  printResult(result, ctx.json, formatAntigravityAccounts)
}

type BlockState = ClaudeRateLimitAccountsState | CodexRateLimitAccountsState

function printBlockState(
  ctx: HandlerContext,
  agent: 'claude' | 'codex',
  result: RuntimeRpcSuccess<BlockState>
): void {
  printResult(result, ctx.json, (state) =>
    formatAccountsBlock(agent === 'claude' ? 'Claude' : 'Codex', state)
  )
}

export async function selectProviderAccount(
  ctx: HandlerContext,
  agent: ProviderAccountAgent
): Promise<void> {
  const id = getRequiredStringFlag(ctx.flags, 'account')
  if (agent === 'antigravity') {
    const result = await ctx.client.call<AntigravityAccountState>('accounts.antigravitySelect', {
      target: antigravityTarget(ctx),
      accountId: id
    })
    printResult(result, ctx.json, formatAntigravityAccounts)
    return
  }
  // Why: `system` is the default login, which the host stores as a null selection.
  const accountId = id === 'system' ? null : id
  const target = agent === 'codex' ? readTarget(ctx) : undefined
  const method =
    agent === 'claude'
      ? 'accounts.selectClaude'
      : target
        ? 'accounts.selectCodexForTarget'
        : 'accounts.selectCodex'
  const result = await ctx.client.call<BlockState>(
    method,
    target ? { accountId, target } : { accountId }
  )
  printBlockState(ctx, agent, result)
}

export async function removeProviderAccount(
  ctx: HandlerContext,
  agent: ProviderAccountAgent
): Promise<void> {
  const accountId = getRequiredStringFlag(ctx.flags, 'account')
  if (agent === 'antigravity') {
    const result = await ctx.client.call<AntigravityAccountState>('accounts.antigravityRemove', {
      target: antigravityTarget(ctx),
      accountId
    })
    printResult(result, ctx.json, formatAntigravityAccounts)
    return
  }
  const result = await ctx.client.call<BlockState>(
    agent === 'claude' ? 'accounts.removeClaude' : 'accounts.removeCodex',
    { accountId }
  )
  printBlockState(ctx, agent, result)
}

function activeCodexAccountId(
  state: CodexRateLimitAccountsState,
  target: AccountTarget
): string | null {
  const byRuntime = state.activeAccountIdsByRuntime
  if (target.runtime === 'host') {
    return byRuntime?.host ?? state.activeAccountId
  }
  return byRuntime?.wsl[target.wslDistro] ?? null
}

function formatResetResult(result: CodexResetResult): string {
  if (result.status === 'rejectedBeforeProvider') {
    return `Codex reset credit was not spent: ${result.reason ?? 'rejected before the provider'}.`
  }
  const outcome =
    typeof result.outcome === 'string' ? result.outcome : JSON.stringify(result.outcome ?? null)
  return `Codex reset credit outcome: ${outcome}`
}

/** Spends one earned Codex reset credit, with the scope the host reports right now. */
export async function consumeCodexResetCredit(ctx: HandlerContext): Promise<void> {
  rejectRemoteSelectionFlags(
    ctx.flags,
    '`orca account codex-reset-credit`. Run it on the host whose accounts you want to manage.'
  )
  const accountId = getRequiredStringFlag(ctx.flags, 'account')
  const target: AccountTarget = readTarget(ctx) ?? { runtime: 'host', wslDistro: null }
  // Why: a fresh read keeps the scope's revisions current, or the host rejects the spend as stale.
  const listing = await ctx.client.call<{
    codex: CodexRateLimitAccountsState
    rateLimits: RateLimitState
  }>('accounts.list', { refreshUsage: true })
  const { codex, rateLimits } = listing.result
  const account = codex.accounts.find((candidate) => candidate.id === accountId) ?? null
  if (!account) {
    throw new RuntimeClientError('not_found', `No managed Codex account ${accountId}.`)
  }
  if (activeCodexAccountId(codex, target) !== accountId) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Codex account ${accountId} is not the selected one for this target; run \`orca account select --agent codex --account ${accountId}\` first.`
    )
  }
  const expectedScope = buildCodexResetCreditExpectedScope({
    target,
    account,
    limits: rateLimits.codex ?? null
  })
  if (!expectedScope) {
    throw new RuntimeClientError(
      'invalid_argument',
      `The host reports no reset credit to spend for Codex account ${accountId} on this target.`
    )
  }
  const result = await ctx.client.call<CodexResetResult>('accounts.consumeCodexResetCredit', {
    idempotencyKey: randomUUID(),
    expectedScope
  })
  printResult(result, ctx.json, formatResetResult)
}
