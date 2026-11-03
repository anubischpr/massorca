import { useMemo } from 'react'
import { NativeChatStructuredQuestionCard } from '@/components/native-chat/NativeChatStructuredQuestionCard'
import { usePendingSessionQuestion } from '@/components/native-chat/use-pending-session-question'
import { botTeamHostTarget, useBotTeamHost } from '@/runtime/bot-team-host'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotAgentIcon } from './BotAgentIcon'

/**
 * A waiting task session's question, asked in the room by the task's bot. Mount it only for a task
 * whose session waits: it holds the session open while mounted.
 */
export function BotTeamRoomQuestion({
  task,
  bot
}: {
  task: BotTeamTask
  bot: BotTeam['bots'][number]
}): React.JSX.Element | null {
  const host = useBotTeamHost()
  const target = useMemo(() => botTeamHostTarget(host), [host])
  const question = usePendingSessionQuestion(task.sessionId, { target, agent: bot.agent })
  if (!question) {
    return null
  }
  return (
    <div data-bot-team-question={task.id} className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <BotAgentIcon agent={bot.agent} size={16} />
        {bot.name}
      </div>
      <NativeChatStructuredQuestionCard
        key={`${question.itemId}:${question.revision}`}
        questions={question.prompt.questions}
        delegation={question.prompt.delegation}
        isSubmitting={question.isSubmitting}
        onAnswer={(response) => void question.answer(response)}
        onCancel={() => void question.cancel()}
      />
    </div>
  )
}
