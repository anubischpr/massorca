import { Text, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileNativeChatPromptCard } from '../session/MobileNativeChatPromptCard'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamRoomQuestion } from './use-mobile-bot-team-room-question'

/** A waiting task session's question, asked in the room by the task's bot. */
function MobileBotTeamRoomQuestion({
  client,
  task,
  bot,
  scope
}: {
  client: RpcClient
  task: BotTeamTask
  bot: BotTeam['bots'][number]
  /** Keeps the session's cache apart from the same ids on another host or workspace. */
  scope: string
}) {
  const { question, respondQuestion, cancelPrompt } = useMobileBotTeamRoomQuestion(
    client,
    task,
    bot,
    scope
  )
  if (!question) {
    return null
  }
  return (
    <View testID={`room-question-${task.id}`} style={styles.roomEntry}>
      <View style={styles.roomWho}>
        <MobileBotAgentIcon agentId={bot.agent} size={14} />
        <Text style={styles.roomWhoText}>{bot.name}</Text>
      </View>
      <MobileNativeChatPromptCard
        question={question}
        onAnswerQuestion={respondQuestion}
        onCancelPrompt={cancelPrompt}
      />
    </View>
  )
}

/** The questions of the team's waiting tasks; mount a task here only while its session waits. */
export function MobileBotTeamRoomQuestions({
  client,
  team,
  tasks,
  scope
}: {
  client: RpcClient
  team: BotTeam
  tasks: readonly BotTeamTask[]
  scope: string
}) {
  return tasks.map((task) => {
    const bot = team.bots.find((entry) => entry.id === task.ownerBotId)
    return bot && task.sessionId !== null ? (
      <MobileBotTeamRoomQuestion
        key={task.id}
        client={client}
        task={task}
        bot={bot}
        scope={scope}
      />
    ) : null
  })
}
