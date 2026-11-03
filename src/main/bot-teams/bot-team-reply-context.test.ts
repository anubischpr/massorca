import { describe, expect, it } from 'vitest'
import type { BotTeamEngramMemory } from '../../shared/rpc-contract/bot-team-engram-params'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import {
  botTeamProjectContext,
  ENGRAM_CONTEXT_MAX_CHARS,
  ENGRAM_CONTEXT_MAX_ENTRIES
} from './bot-team-reply-context'

const BOTS = [
  { id: 'rosa', name: 'Rosa' },
  { id: 'iris', name: 'Iris' }
]
const NEXUS = {
  id: 'p1',
  name: 'NexusCare',
  brief: { requirements: [], constraints: [], decisions: [] }
}
const MEMORY = { team: ['Weekly review on Mondays'], bot: ['Rosa prefers short notes'] }

function task(overrides: Partial<BotTeamTask>): BotTeamTask {
  return {
    id: 'k',
    teamId: 't1',
    title: 'Task',
    prompt: '',
    ownerBotId: 'rosa',
    sessionId: null,
    projectId: 'p1',
    ...overrides
  }
}

const TASKS = [
  task({ id: 'k1', title: 'Mapear flujos', ownerBotId: 'rosa', sessionId: 's1' }),
  task({ id: 'k2', title: 'Redactar piloto', ownerBotId: 'iris' }),
  task({ id: 'k3', title: 'Plantilla', teamId: 't2', ownerBotId: 'someone-else' })
]

function engram(count: number, excerpt: string, prefix = 'Note'): BotTeamEngramMemory[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index}`,
    title: `${prefix} ${index}`,
    excerpt
  }))
}

function context(overrides: Partial<Parameters<typeof botTeamProjectContext>[0]> = {}): string {
  return botTeamProjectContext({
    project: NEXUS,
    tasks: TASKS,
    bots: BOTS,
    memory: MEMORY,
    botName: 'Rosa',
    engram: null,
    briefOnly: false,
    ...overrides
  })
}

describe('botTeamProjectContext', () => {
  it('names the project and gives the saved Markdown brief', () => {
    const text = context({
      project: {
        ...NEXUS,
        brief: { requirements: [], constraints: [], decisions: [], markdown: '# Plan\nPilot.' }
      }
    })
    expect(text).toContain('Project "NexusCare"')
    expect(text).toContain('# Plan\nPilot.')
  })

  it('gives the brief lists when no Markdown is saved', () => {
    const text = context({
      project: {
        ...NEXUS,
        brief: { requirements: ['Pilot in May'], constraints: ['No PHI'], decisions: [] }
      }
    })
    expect(text).toContain('## Requirements\n- Pilot in May')
    expect(text).toContain('## Constraints\n- No PHI')
  })

  it('says there is no brief when the project has none', () => {
    expect(context()).toContain('No brief saved yet.')
  })

  it('lists every task of the project with its status and owner, whichever team filed it', () => {
    const text = context()
    expect(text).toContain('- Mapear flujos, Rosa, started')
    expect(text).toContain('- Redactar piloto, Iris, not started')
    expect(text).toContain('- Plantilla, a bot, not started')
  })

  it('says there are no tasks when the project has none', () => {
    expect(context({ tasks: [] })).toContain('No tasks yet.')
  })

  it('gives the team and the answering bot what they remember', () => {
    const text = context()
    expect(text).toContain('What the team remembers')
    expect(text).toContain('- Weekly review on Mondays')
    expect(text).toContain('What Rosa remembers:')
    expect(text).toContain('- Rosa prefers short notes')
  })

  it('shows each Engram memory with its type and excerpt', () => {
    const text = context({
      engram: [{ id: 'e1', title: 'Pilot scope', type: 'decision', excerpt: 'Three clinics' }]
    })
    expect(text).toContain('- Pilot scope (decision): Three clinics')
  })

  it('keeps at most eight Engram memories and two thousand characters of them', () => {
    const longText = context({ engram: engram(12, 'x'.repeat(400)) })
    const longLines = longText.split('\n').filter((line) => line.startsWith('- Note '))
    expect(longLines.length).toBeLessThanOrEqual(ENGRAM_CONTEXT_MAX_ENTRIES)
    expect(longLines.join('\n').length).toBeLessThanOrEqual(ENGRAM_CONTEXT_MAX_CHARS)

    const shortText = context({ engram: engram(10, 'ok', 'Short') })
    expect(shortText.split('\n').filter((line) => line.startsWith('- Short ')).length).toBe(
      ENGRAM_CONTEXT_MAX_ENTRIES
    )
  })

  it('gives a research question only the brief, not the tasks, memories or Engram lines', () => {
    const text = context({
      project: {
        ...NEXUS,
        brief: { requirements: ['Pilot in May'], constraints: [], decisions: [] }
      },
      engram: engram(2, 'Engram body'),
      briefOnly: true
    })
    expect(text).toContain('Pilot in May')
    expect(text).not.toContain('Mapear flujos')
    expect(text).not.toContain('Weekly review')
    expect(text).not.toContain('Engram body')
  })
})
