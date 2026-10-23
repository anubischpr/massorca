import { hasActiveProviderUsage, type UsageWindowKey } from './account-usage-state'
import {
  ProviderRateLimitsSchema,
  type AccountsSnapshot,
  type ProviderRateLimits
} from './accounts-snapshot'

// Why: these meters have no Orca-managed accounts; the host polls them for subscribed clients and
// publishes them beside Claude and Codex in `accounts.list`. Order and labels match desktop.
const HOST_USAGE_METERS = [
  { key: 'antigravity', label: 'Antigravity', iconAgentId: 'antigravity' },
  // Desktop draws the NaN meter with the Pi mark.
  { key: 'nan', label: 'NaN', iconAgentId: 'pi' }
] as const

const USAGE_WINDOWS: readonly { key: UsageWindowKey; label: string }[] = [
  { key: 'session', label: '5h' },
  { key: 'weekly', label: '7d' },
  { key: 'monthly', label: '30d' }
]

export type HostUsageMeterKey = (typeof HOST_USAGE_METERS)[number]['key']

export type HostUsageMeter = {
  key: HostUsageMeterKey
  label: string
  iconAgentId: string
  limits: ProviderRateLimits
  windows: readonly { key: UsageWindowKey; label: string }[]
}

/** One host meter's limits, or null when the host omits it (an older host) or sends a shape this
 *  build cannot read, so one bad meter never fails the whole accounts snapshot. */
export function readHostUsageMeterLimits(
  snapshot: AccountsSnapshot,
  key: HostUsageMeterKey
): ProviderRateLimits | null {
  const parsed = ProviderRateLimitsSchema.safeParse(snapshot.rateLimits[key])
  return parsed.success && parsed.data.provider === key ? parsed.data : null
}

/** The host meters with usage worth showing, each with the windows it reports. */
export function getHostUsageMeters(snapshot: AccountsSnapshot): HostUsageMeter[] {
  return HOST_USAGE_METERS.flatMap((meter) => {
    const limits = readHostUsageMeterLimits(snapshot, meter.key)
    if (!limits || !hasActiveProviderUsage(limits)) {
      return []
    }
    const windows = USAGE_WINDOWS.filter((window) => limits[window.key] != null)
    // A meter still reading its first window keeps one placeholder bar instead of an empty row.
    return [{ ...meter, limits, windows: windows.length > 0 ? windows : USAGE_WINDOWS.slice(0, 1) }]
  })
}
