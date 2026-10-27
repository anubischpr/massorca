import { ChartNoAxesColumn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NativeChatSessionVisual } from './native-chat-session-summary'

/** A visual the chat shows, listed in Results beside file changes. Compact rows only name it; expanded
 *  rows open it in the sidebar, the same as the inline visual's expand control. */
export function NativeChatSessionVisualRow({
  visual,
  expanded,
  onOpen
}: {
  visual: NativeChatSessionVisual
  expanded?: boolean
  onOpen?: (visual: NativeChatSessionVisual) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const label = visual.title ?? visual.file
  const kind = t('components.nativeChatSummary.visualKind', 'Visual')
  if (!expanded || !onOpen) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 truncate" title={label}>
        <ChartNoAxesColumn aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </p>
    )
  }
  return (
    <button
      type="button"
      className="flex w-full min-w-0 items-center gap-1.5 rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-ring"
      title={label}
      onClick={() => onOpen(visual)}
    >
      <ChartNoAxesColumn aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 text-muted-foreground">{kind}</span>
    </button>
  )
}
