import { describe, expect, it } from 'vitest'
import { splitBackgroundWorkSections } from './mobile-background-work-sections'

describe('splitBackgroundWorkSections', () => {
  it('puts subagents in the agents section and every other kind in tasks', () => {
    const groups = [
      { kind: 'command' as const, tasks: [] },
      { kind: 'agent' as const, tasks: [] },
      { kind: 'monitor' as const, tasks: [] },
      { kind: 'workflow' as const, tasks: [] }
    ]
    const sections = splitBackgroundWorkSections(groups)
    expect(sections.tasks.map((group) => group.kind)).toEqual(['command', 'monitor', 'workflow'])
    expect(sections.agents.map((group) => group.kind)).toEqual(['agent'])
  })

  it('returns empty sections for an empty roster', () => {
    expect(splitBackgroundWorkSections([])).toEqual({ tasks: [], agents: [] })
  })
})
