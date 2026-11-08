import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import type {
  ProviderRateLimits,
  RateLimitState,
  RateLimitWindow
} from '../../shared/rate-limit-types'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import { RuntimeClientError } from '../runtime-client'

type UsageProviderKey =
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'opencodeGo'
  | 'kimi'
  | 'antigravity'
  | 'minimax'
  | 'grok'
  | 'cursor'
  | 'zcode'
  | 'nan'

// Why: a fixed order keeps the rows in the same place on every run.
const USAGE_PROVIDERS: readonly (readonly [UsageProviderKey, string])[] = [
  ['claude', 'Claude'],
  ['codex', 'Codex'],
  ['gemini', 'Gemini'],
  ['opencodeGo', 'OpenCode Go'],
  ['kimi', 'Kimi'],
  ['antigravity', 'Antigravity'],
  ['minimax', 'MiniMax'],
  ['grok', 'Grok'],
  ['cursor', 'Cursor'],
  ['zcode', 'ZCode'],
  ['nan', 'NaN']
]

type AccountsUsageSnapshot = { rateLimits: RateLimitState }

function formatWindow(name: string, usageWindow: RateLimitWindow | null | undefined): string {
  if (!usageWindow) {
    return `${name} n/a`
  }
  const reset =
    usageWindow.resetDescription ??
    (typeof usageWindow.resetsAt === 'number' ? new Date(usageWindow.resetsAt).toISOString() : null)
  return `${name} ${Math.round(usageWindow.usedPercent)}%${reset ? ` (resets ${reset})` : ''}`
}

function formatProvider(label: string, data: ProviderRateLimits): string {
  const windows = [
    formatWindow('session', data.session),
    formatWindow('weekly', data.weekly),
    ...(data.monthly ? [formatWindow('monthly', data.monthly)] : [])
  ]
  // Why: the provider's error text is never printed; the status word says the numbers may be stale.
  const status = data.status === 'ok' ? '' : ` [${data.status}]`
  return `${label}: ${windows.join(', ')}${status}`
}

function formatUsage(state: RateLimitState): string {
  const lines = USAGE_PROVIDERS.flatMap(([key, label]) => {
    const data = state[key]
    return data ? [formatProvider(label, data)] : []
  })
  return lines.length > 0
    ? lines.join('\n')
    : 'No usage data yet. Run `orca account usage --refresh`.'
}

export const ACCOUNT_USAGE_HANDLERS: Record<string, CommandHandler> = {
  'account usage': async (ctx) => {
    rejectRemoteSelectionFlags(
      ctx.flags,
      '`orca account usage`. Run it on the host whose accounts you want to see.'
    )
    const refresh = ctx.flags.get('refresh')
    if (typeof refresh === 'string') {
      throw new RuntimeClientError('invalid_argument', '--refresh takes no value.')
    }
    const response = await ctx.client.call<AccountsUsageSnapshot>('accounts.list', {
      refreshUsage: refresh === true
    })
    printResult({ ...response, result: response.result.rateLimits }, ctx.json, formatUsage)
  }
}
