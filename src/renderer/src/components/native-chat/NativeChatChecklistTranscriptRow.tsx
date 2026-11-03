import { useState } from 'react'
import { ChevronRight, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAppStore } from '@/store'
import { NATIVE_CHAT_CHECKLIST_FENCE_INFO } from '../../../../shared/native-chat-checklist'
import { NativeChatCodeBlock, extractCodeText } from './NativeChatCodeBlock'
import { nativeChatChecklistFenceBlock } from './native-chat-checklist-replies'
import { requestNativeChatOpenSurface } from './native-chat-open-surface'
import { useNativeChatVisualOwner } from './native-chat-visual-owner'

/**
 * A code block in an agent reply. An `orca-checklist` fence in a structured chat becomes a row that
 * opens the chat's checklist in the summary; every other fence, and any fence elsewhere, stays a code block.
 */
export function NativeChatAgentCodeBlock({
  children,
  language
}: {
  children?: React.ReactNode
  language?: string
}): React.JSX.Element {
  const owner = useNativeChatVisualOwner()
  if (language !== NATIVE_CHAT_CHECKLIST_FENCE_INFO || !owner) {
    return <NativeChatCodeBlock language={language}>{children}</NativeChatCodeBlock>
  }
  return (
    <NativeChatChecklistFenceRow sessionId={owner.sessionId} code={extractCodeText(children)} />
  )
}

function NativeChatChecklistFenceRow({
  sessionId,
  code
}: {
  sessionId: string
  code: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const updateSettings = useAppStore((store) => store.updateSettings)
  const block = nativeChatChecklistFenceBlock(code)
  const items = block?.items ?? []
  const checked = items.filter((item) => item.checked).length
  return (
    <button
      type="button"
      onClick={() => {
        void updateSettings({ nativeChatSummaryVisible: true })
        requestNativeChatOpenSurface(sessionId, 'checklist')
      }}
      className="my-2 flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ListChecks aria-hidden className="size-3.5 shrink-0" />
      <span className="shrink-0 font-medium text-foreground">
        {t('components.nativeChatSummary.checklist', 'Checklist')}
      </span>
      {block?.title ? <span className="min-w-0 flex-1 truncate">{block.title}</span> : null}
      <span className="ml-auto shrink-0 tabular-nums">
        {checked}/{items.length}
      </span>
      <ChevronRight aria-hidden className="size-3.5 shrink-0" />
    </button>
  )
}

/** The host's checklist update in front of a person's message, shown as a chip the person can open. */
export function NativeChatChecklistUpdateChip({ update }: { update: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ListChecks aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">
            {t('components.native-chat.checklist.changes', 'Checklist changes')}
          </span>
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 group-data-[state=open]:rotate-90"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            'components.native-chat.checklist.sentWithMessage',
            'Sent to the agent with this message'
          )}
        </p>
        <pre className="scrollbar-sleek mt-1 max-h-48 overflow-auto rounded-md border border-chat-code-border bg-chat-code-surface p-2 font-mono text-xs whitespace-pre-wrap break-words text-chat-code-foreground">
          {update}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
