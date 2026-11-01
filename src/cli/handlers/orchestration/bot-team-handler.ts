import type { CommandHandler } from '../../dispatch'
import { printResult } from '../../format'
import { getRequiredStringFlag } from '../../flags'
import { RuntimeClientError } from '../../runtime-client'
import { readInjectedAgentSessionId } from '../../../shared/agent-session-caller-env'
import { callOrchestrationMutation } from './mutation-request'

type ListedTask = { title: string; sessionId: string | null }

// Checked before any call: the chat is the caller, and only it says which team this is for.
function requireChat(command: string): void {
  if (!readInjectedAgentSessionId()) {
    throw new RuntimeClientError(
      'bot_team_requires_chat',
      `${command} can only be used from a MassOrca chat session (ORCA_AGENT_SESSION_ID is not set in this environment). Nothing was changed.`
    )
  }
}

export const ORCHESTRATION_BOT_TEAM_HANDLER: Record<string, CommandHandler> = {
  'orchestration team-post': async ({ flags, client, json }) => {
    requireChat('orchestration team-post')
    const result = await callOrchestrationMutation(client, flags, 'orchestration.botTeamPost', {
      text: getRequiredStringFlag(flags, 'text')
    })
    printResult(result, json, () => 'Posted to the Conference room.')
  },
  'orchestration team-tasks': async ({ flags, client, json }) => {
    requireChat('orchestration team-tasks')
    const result = await callOrchestrationMutation<{ tasks: ListedTask[] }>(
      client,
      flags,
      'orchestration.botTeamTasks',
      undefined
    )
    printResult(result, json, (value) =>
      value.tasks
        .map((task) => `${task.sessionId === null ? 'Not started' : 'Started'}: ${task.title}`)
        .join('\n')
    )
  },
  'orchestration team-task-create': async ({ flags, client, json }) => {
    requireChat('orchestration team-task-create')
    const result = await callOrchestrationMutation<{ task: ListedTask }>(
      client,
      flags,
      'orchestration.botTeamTaskCreate',
      { text: getRequiredStringFlag(flags, 'text') }
    )
    printResult(result, json, (value) => `Saved to Todo: ${value.task.title}`)
  }
}
