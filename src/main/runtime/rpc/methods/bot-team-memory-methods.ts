import {
  BotTeamMemoryDelete,
  BotTeamMemoryList
} from '../../../../shared/rpc-contract/bot-team-memory-params'
import { defineMethod } from '../core'
import { BOT_TEAM_ENGRAM_METHODS } from './bot-team-engram-methods'

export const botTeamListMemoryMethod = defineMethod({
  name: 'botTeams.listMemory',
  permission: 'workspace',
  params: BotTeamMemoryList,
  handler: ({ teamId }, { runtime }) => ({
    memory: runtime.getOrchestrationDb().listBotTeamMemory(teamId)
  })
})

export const botTeamDeleteMemoryMethod = defineMethod({
  name: 'botTeams.deleteMemory',
  permission: 'workspace',
  params: BotTeamMemoryDelete,
  handler: ({ memoryId }, { runtime }) => ({
    deleted: runtime.getOrchestrationDb().deleteBotTeamMemory(memoryId)
  })
})

/** What the person can read and delete; Engram's own contents and settings are never touched. */
export const BOT_TEAM_MEMORY_METHODS = [
  botTeamListMemoryMethod,
  botTeamDeleteMemoryMethod,
  ...BOT_TEAM_ENGRAM_METHODS
]
