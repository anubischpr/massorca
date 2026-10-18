import { CircleDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  nativeChatTaskLabel,
  type NativeChatTaskList
} from '../../../../shared/native-chat-task-list'
import { Checklist } from './NativeChatTaskList'
import { NativeChatSessionSection } from './NativeChatSessionSection'

/** The main agent's task plan as the provider reported it; without a report, the section says so. */
export function NativeChatSessionPlanSection({
  list
}: {
  list: NativeChatTaskList | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const title = t('components.nativeChatSummary.plan', 'Plan')
  const noPlan = t('components.nativeChatSummary.planNone', 'No plan reported')
  if (!list) {
    return (
      <NativeChatSessionSection title={title} compact={<p>{noPlan}</p>}>
        <p>{noPlan}</p>
      </NativeChatSessionSection>
    )
  }
  const completed = list.tasks.filter((task) => task.status === 'completed').length
  const current = list.tasks.find((task) => task.status === 'in_progress')
  const progress =
    list.tasks.length > 0
      ? t('components.nativeChatSummary.planProgress', '{{completed}} of {{total}}', {
          completed,
          total: list.tasks.length
        })
      : undefined
  const currentLine =
    list.tasks.length === 0
      ? t('components.native-chat.taskList.empty', 'No tasks')
      : current
        ? nativeChatTaskLabel(current)
        : t('components.nativeChatSummary.planNoneInProgress', 'No item in progress')
  return (
    <NativeChatSessionSection
      title={title}
      summary={progress}
      compact={
        <p className="flex items-start gap-1.5 text-foreground">
          {current ? <CircleDot aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : null}
          <span className="min-w-0 break-words">{currentLine}</span>
        </p>
      }
    >
      <Checklist list={list} />
      {list.explanation ? (
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{list.explanation}</p>
      ) : null}
    </NativeChatSessionSection>
  )
}
