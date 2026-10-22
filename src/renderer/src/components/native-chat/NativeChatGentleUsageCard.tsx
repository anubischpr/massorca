import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useEffectiveRateLimits } from '@/components/status-bar/use-effective-rate-limits'
import { formatTimeAgo } from '@/components/status-bar/tooltip'
import { NativeChatUsageWindowsCard } from './NativeChatUsageWindowsCard'

/** The `/gentle:usage` panel, drawn from the NaN snapshot Orca already tracks; `fallback` when it has none. */
export function NativeChatGentleUsageCard({
  fallback
}: {
  fallback: React.JSX.Element
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const { rateLimits, refresh } = useEffectiveRateLimits(settings)
  const nan = rateLimits.nan
  const buckets = nan?.buckets ?? []
  if (!nan || nan.status === 'unavailable' || buckets.length === 0) {
    return fallback
  }
  return (
    <NativeChatUsageWindowsCard
      title={translate('components.native-chat.gentleUsage.title', 'Subscriptions')}
      subtitle={translate('components.native-chat.gentleUsage.updated', 'nan · updated {{time}}', {
        time: formatTimeAgo(nan.updatedAt)
      })}
      refreshLabel={translate('components.native-chat.gentleUsage.refresh', 'Refresh usage')}
      refresh={refresh}
      windows={buckets.map((bucket) => ({
        label: bucket.name,
        usedPercent: bucket.usedPercent,
        resetsAt: bucket.resetsAt
      }))}
      barClassName="bg-[var(--agent-gentle-shell-fg)]"
      used={(percent) =>
        translate('components.native-chat.gentleUsage.used', '{{percent}}% used', { percent })
      }
      usedResets={(percent, duration) =>
        translate(
          'components.native-chat.gentleUsage.usedResets',
          '{{percent}}% used · resets in {{duration}}',
          { percent, duration }
        )
      }
    />
  )
}
