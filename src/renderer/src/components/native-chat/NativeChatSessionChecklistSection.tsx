import { useState } from 'react'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { useTranslation } from 'react-i18next'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { NativeChatSessionSection } from './NativeChatSessionSection'
import { NativeChatChecklistBody } from './NativeChatChecklistBody'
import { useNativeChatChecklist } from './use-native-chat-checklist'

/** The checklist card in the chat summary, under the plan: the agent's items with the person's marks. */
export function NativeChatSessionChecklistSection({
  target,
  sessionId,
  journalItems,
  agentLabel,
  worktreeId
}: {
  target: RuntimeClientTarget
  sessionId: string
  journalItems: readonly AgentJournalRenderItem[]
  /** The chat's agent as the person knows it, such as "Claude". */
  agentLabel: string
  worktreeId: string | null
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const state = useNativeChatChecklist({ target, sessionId, journalItems, polling: open })
  const { checklist } = state
  const items = checklist?.items ?? []
  const empty = items.length === 0
  const nextUnchecked = items.find((item) => !item.checked)

  return (
    <NativeChatSessionSection
      title={t('components.nativeChatSummary.checklist', 'Checklist')}
      summary={
        empty
          ? undefined
          : t('components.nativeChatSummary.checklistProgress', '{{checked}} of {{total}}', {
              checked: checklist?.checked ?? 0,
              total: items.length
            })
      }
      compact={
        empty ? (
          <p className="text-foreground">
            {t('components.nativeChatSummary.checklistNone', 'No checklist yet')}
          </p>
        ) : nextUnchecked ? (
          <p className="truncate text-foreground" title={nextUnchecked.text}>
            {nextUnchecked.text}
          </p>
        ) : (
          <p className="text-foreground">
            {t('components.nativeChatSummary.checklistAllChecked', 'All checked')}
          </p>
        )
      }
      openRequest={{ sessionId, surface: 'checklist' }}
      onOpenChange={setOpen}
    >
      <NativeChatChecklistBody
        target={target}
        sessionId={sessionId}
        agentLabel={agentLabel}
        worktreeId={worktreeId}
        state={state}
      />
    </NativeChatSessionSection>
  )
}
