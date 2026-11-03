import { briefMarkdownFromLists } from '../../shared/bot-team-project-brief-markdown'
import type { BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamEngramMemory } from '../../shared/rpc-contract/bot-team-engram-params'
import type { BotTeamProject, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamMemoryLines } from './bot-team-task-start'

/** The most Engram memories a reply reads, and the most characters of them its prompt takes. */
export const ENGRAM_CONTEXT_MAX_ENTRIES = 8
export const ENGRAM_CONTEXT_MAX_CHARS = 2000

export type BotTeamProjectContextArgs = {
  project: Pick<BotTeamProject, 'name' | 'brief'>
  /** The project's tasks, from every team that files in it. */
  tasks: readonly BotTeamTask[]
  bots: readonly Pick<BotTeamBot, 'id' | 'name'>[]
  memory: BotTeamMemoryLines
  botName: string
  /** The latest Engram memories of the project's repo; null when none is linked or read. */
  engram: readonly BotTeamEngramMemory[] | null
  /** A research question gets the brief only. */
  briefOnly: boolean
}

/** The brief as the bots read it: the saved Markdown, else its lists, else a note that there is none. */
function briefText(brief: BotTeamProject['brief']): string {
  const markdown = brief.markdown?.trim() ?? ''
  if (markdown !== '') {
    return markdown
  }
  if (brief.requirements.length + brief.constraints.length + brief.decisions.length > 0) {
    return briefMarkdownFromLists(brief).trim()
  }
  return 'No brief saved yet.'
}

function taskLines(
  tasks: readonly BotTeamTask[],
  bots: BotTeamProjectContextArgs['bots']
): string[] {
  return tasks.map((task) => {
    const owner = bots.find((bot) => bot.id === task.ownerBotId)?.name ?? 'a bot'
    return `- ${task.title}, ${owner}, ${task.sessionId === null ? 'not started' : 'started'}`
  })
}

function memoryBlock(heading: string, lines: readonly string[]): string[] {
  return lines.length > 0 ? [`${heading}\n${lines.map((line) => `- ${line}`).join('\n')}`] : []
}

/** The newest memories that fit the cap, in the order the reader gave them. */
function engramLines(memories: readonly BotTeamEngramMemory[]): string[] {
  const lines: string[] = []
  let chars = 0
  for (const memory of memories.slice(0, ENGRAM_CONTEXT_MAX_ENTRIES)) {
    const type = memory.type ? ` (${memory.type})` : ''
    const line = `- ${memory.title}${type}: ${memory.excerpt}`
    if (chars + line.length > ENGRAM_CONTEXT_MAX_CHARS) {
      break
    }
    lines.push(line)
    chars += line.length + 1
  }
  return lines
}

/**
 * The project a question names, as the reply prompt reads it. The sections are data for the bot, not
 * instructions; a research question gets the brief only.
 */
export function botTeamProjectContext(args: BotTeamProjectContextArgs): string {
  const { project } = args
  const sections = [
    `Project "${project.name}" (the question names it). Its brief:\n${briefText(project.brief)}`
  ]
  if (args.briefOnly) {
    return sections.join('\n\n')
  }
  sections.push(
    `Its tasks, from every team that works on it (a started task may already be done; a bot's line in the room history says when it finished):\n${taskLines(args.tasks, args.bots).join('\n') || 'No tasks yet.'}`,
    ...memoryBlock('What the team remembers (use it, and do not ask again):', args.memory.team),
    ...memoryBlock(`What ${args.botName} remembers:`, args.memory.bot)
  )
  const engram = args.engram ? engramLines(args.engram) : []
  if (engram.length > 0) {
    sections.push(
      `Engram memories for ${project.name} (the latest, read-only):\n${engram.join('\n')}`
    )
  }
  return sections.join('\n\n')
}
