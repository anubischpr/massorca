import type { CommandHandler } from '../../dispatch'
import { printResult } from '../../format'
import { getOptionalStringFlag, getRequiredStringFlag } from '../../flags'
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

// The team is optional: without it the bot is looked up on the caller's own team.
function teamFlag(flags: Map<string, string | boolean>): { team?: string } {
  const team = getOptionalStringFlag(flags, 'team')
  return team ? { team } : {}
}

export const ORCHESTRATION_BOT_TEAM_HANDLER: Record<string, CommandHandler> = {
  'orchestration team-post': async ({ flags, client, json }) => {
    requireChat('orchestration team-post')
    const result = await callOrchestrationMutation(client, flags, 'orchestration.botTeamPost', {
      text: getRequiredStringFlag(flags, 'text')
    })
    printResult(result, json, () => 'Posted to the Conference room.')
  },
  'orchestration team-delegate': async ({ flags, client, json }) => {
    requireChat('orchestration team-delegate')
    const result = await callOrchestrationMutation<{ task: ListedTask }>(
      client,
      flags,
      'orchestration.botTeamDelegate',
      {
        bot: getRequiredStringFlag(flags, 'bot'),
        text: getRequiredStringFlag(flags, 'text'),
        ...teamFlag(flags)
      }
    )
    printResult(result, json, (value) => `Handed to teammate: ${value.task.title}`)
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
