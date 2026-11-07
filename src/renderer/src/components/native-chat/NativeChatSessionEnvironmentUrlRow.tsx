import { useState } from 'react'
import { Copy, ExternalLink, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NativeChatEnvironmentUrl } from '../../../../shared/native-chat-environment-urls'

/** An environment URL in Results. Compact rows only name it; expanded rows open and copy it. `route`
 *  is what this PC opens: null for a remote host's loopback URL with no forward, which stays copyable. */
export function NativeChatSessionEnvironmentUrlRow({
  entry,
  route,
  expanded
}: {
  entry: NativeChatEnvironmentUrl
  route: string | null
  expanded?: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const previous = entry.previous ? t('components.nativeChatSummary.previousUrl', 'Previous') : null
  const label = (
    <span
      className={cn('flex min-w-0 items-center gap-1.5', previous && 'text-muted-foreground')}
      title={entry.url}
    >
      <Globe aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      <span className={expanded ? 'min-w-0 break-all' : 'truncate'}>{entry.url}</span>
      {previous ? <span className="shrink-0">{previous}</span> : null}
    </span>
  )
  if (!expanded) {
    return <p className="min-w-0">{label}</p>
  }
  const act = async (copy: boolean) => {
    setError(null)
    try {
      await (copy
        ? navigator.clipboard.writeText(route ?? entry.url)
        : route && window.api.shell.openUrl(route))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }
  return (
    <div className="space-y-1 break-words">
      {label}
      <div className="flex gap-2">
        <Button variant="outline" size="xs" disabled={!route} onClick={() => void act(false)}>
          <ExternalLink />
          {t('components.nativeChatSummary.openUrl', 'Open')}
        </Button>
        <Button variant="outline" size="xs" onClick={() => void act(true)}>
          <Copy />
          {t('components.nativeChatSummary.copy', 'Copy URL')}
        </Button>
      </div>
      {route ? null : (
        <p className="text-muted-foreground">
          {t(
            'components.nativeChatSummary.remoteUrlOnHost',
            'This URL is on the remote host. Forward its port to open it on this PC.'
          )}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
