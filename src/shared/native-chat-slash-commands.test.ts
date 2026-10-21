import { describe, expect, it } from 'vitest'
import {
  applySlashSuggestion,
  filterSlashCommands,
  getAgentSlashCommands,
  hostCommandAlias,
  isSlashCommandDraft,
  sessionReportedSkillNames,
  sessionSlashCommandSuggestions,
  slashCommandDispatchText
} from './native-chat-slash-commands'

describe('host command aliases', () => {
  it('maps Pi /thinking and /new to the shared commands, and only for Pi', () => {
    expect(hostCommandAlias('pi', 'thinking')).toBe('effort')
    expect(hostCommandAlias('pi', 'new')).toBe('clear')
    expect(hostCommandAlias('pi', 'resume')).toBeUndefined()
    expect(hostCommandAlias('codex', 'new')).toBeUndefined()
    expect(hostCommandAlias(undefined, 'thinking')).toBeUndefined()
  })

  it('keeps the aliases in the Pi list as hidden rows and lists nothing else hidden', () => {
    const hidden = getAgentSlashCommands('pi')
      .filter((command) => command.hidden === true)
      .map((command) => command.name)
    expect(hidden).toEqual(['thinking', 'new'])
  })
})

describe('getAgentSlashCommands', () => {
  it('returns Codex-specific commands (e.g. /model, /resume) for codex', () => {
    const names = getAgentSlashCommands('codex').map((c) => c.name)
    expect(names).toContain('model')
    expect(names).toContain('resume')
    expect(names).toContain('diff')
  })

  it('returns Claude commands for claude (no Codex-only /model)', () => {
    const names = getAgentSlashCommands('claude').map((c) => c.name)
    expect(names).toContain('clear')
    expect(names).toContain('compact')
    expect(names).not.toContain('model')
    // Claude's terminal writes no /context reply the chat could show.
    expect(names).not.toContain('context')
  })

  it('offers OpenClaude /context, whose report lands in its transcript', () => {
    const names = getAgentSlashCommands('openclaude').map((c) => c.name)
    expect(names).toEqual([...getAgentSlashCommands('claude').map((c) => c.name), 'context'])
  })

  it('falls back to a small common set for an unknown agent (never empty)', () => {
    const names = getAgentSlashCommands('some-other-agent').map((c) => c.name)
    expect(names).toEqual(['clear', 'help'])
  })
})

describe('isSlashCommandDraft', () => {
  it('is true for a leading slash, even with leading whitespace', () => {
    expect(isSlashCommandDraft('/clear')).toBe(true)
    expect(isSlashCommandDraft('  /model')).toBe(true)
  })

  it('is false for ordinary prose or a mid-line slash', () => {
    expect(isSlashCommandDraft('fix the bug')).toBe(false)
    expect(isSlashCommandDraft('run a/b test')).toBe(false)
    expect(isSlashCommandDraft('')).toBe(false)
  })
})

describe('filterSlashCommands', () => {
  const codex = getAgentSlashCommands('codex')

  it('returns all commands for an empty query (bare /)', () => {
    expect(filterSlashCommands(codex, '')).toHaveLength(codex.length)
  })

  it('prefix-matches case-insensitively', () => {
    const names = filterSlashCommands(codex, 'mod').map((c) => c.name)
    expect(names).toEqual(['model'])
    expect(filterSlashCommands(codex, 'MOD').map((c) => c.name)).toEqual(['model'])
  })
})

describe('dispatch vs completion text', () => {
  it('dispatch text has no trailing space (Enter dispatches the command)', () => {
    expect(slashCommandDispatchText({ name: 'clear' })).toBe('/clear')
  })

  it('completion text has a trailing space (Tab completes for arguments)', () => {
    expect(applySlashSuggestion({ name: 'model' })).toBe('/model ')
  })
})

describe('a session that reports its own command surface', () => {
  const reported = [
    { name: 'clear', kind: 'command' as const },
    { name: 'opsx:apply', kind: 'command' as const },
    { name: 'ref-oss', kind: 'skill' as const }
  ]

  it('offers exactly the reported commands, described from the curated catalog', () => {
    expect(sessionSlashCommandSuggestions('claude', reported)).toEqual([
      { name: 'clear', description: 'Clear conversation history' },
      { name: 'opsx:apply' }
    ])
  })

  it('does not resurrect a curated command the session never reported', () => {
    const names = sessionSlashCommandSuggestions('claude', reported).map((c) => c.name)
    expect(names).not.toContain('compact')
  })

  it('splits skills out for the picker to group on its own', () => {
    expect(sessionReportedSkillNames(reported)).toEqual(['ref-oss'])
  })

  it('prefers the description the session reported over the curated one', () => {
    expect(
      sessionSlashCommandSuggestions('claude', [
        { name: 'clear', kind: 'command', description: 'Wipe the transcript' },
        { name: 'goal', kind: 'command', description: 'Set or view the goal' },
        { name: 'compact', kind: 'command' }
      ])
    ).toEqual([
      { name: 'clear', description: 'Wipe the transcript' },
      { name: 'goal', description: 'Set or view the goal' },
      { name: 'compact', description: 'Summarize and compact the conversation' }
    ])
  })

  it('keeps a reported description and argument hint the curated catalog never claims', () => {
    expect(
      sessionSlashCommandSuggestions('codex', [
        {
          name: 'opsx:apply',
          kind: 'command',
          description: 'Apply the plan',
          argumentHint: '<plan-id>',
          kindUnspecified: true
        }
      ])
    ).toEqual([
      {
        name: 'opsx:apply',
        description: 'Apply the plan',
        argumentHint: '<plan-id>',
        kindUnspecified: true
      }
    ])
  })
})
