import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useEffectiveRateLimits } from '@/components/status-bar/use-effective-rate-limits'
import { formatTimeAgo, getWindowSections } from '@/components/status-bar/tooltip'
import { NativeChatUsageWindowsCard } from './NativeChatUsageWindowsCard'

/** The `/usage` row for Codex, drawn from the account snapshot Orca already tracks; `fallback`
 *  when that snapshot holds no Codex windows. */
export function NativeChatCodexUsageCard({
  fallback
}: {
  fallback: React.JSX.Element
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const { rateLimits, refresh } = useEffectiveRateLimits(settings)
  const codex = rateLimits.codex
  const windows = useMemo(
    () =>
      codex && codex.status !== 'unavailable'
        ? getWindowSections(codex).flatMap(({ label, window }) =>
            window ? [{ label, usedPercent: window.usedPercent, resetsAt: window.resetsAt }] : []
          )
        : [],
    [codex]
  )
  if (!codex || windows.length === 0) {
    return fallback
  }
  return (
    <NativeChatUsageWindowsCard
      title={translate('components.native-chat.codexUsage.title', 'Codex usage')}
      subtitle={translate('components.native-chat.codexUsage.updated', 'Updated {{time}}', {
        time: formatTimeAgo(codex.updatedAt)
      })}
      refreshLabel={translate('components.native-chat.codexUsage.refresh', 'Refresh usage')}
      refresh={refresh}
      windows={windows}
      barClassName="bg-primary"
      used={(percent) =>
        translate('components.native-chat.codexUsage.used', '{{percent}}% used', { percent })
      }
      usedResets={(percent, duration) =>
        translate(
          'components.native-chat.codexUsage.usedResets',
          '{{percent}}% used · resets in {{duration}}',
          { percent, duration }
        )
      }
    />
  )
}
