import { describe, expect, it } from 'vitest'
import { botAgentNameColor } from './bot-team-agent-color'

describe('botAgentNameColor', () => {
  it('gives each agent with a colored icon its own name color', () => {
    const colors = ['claude', 'antigravity', 'pi'] as const
    const values = colors.map((agent) => botAgentNameColor(agent))
    expect(values.every(Boolean)).toBe(true)
    expect(new Set(values).size).toBe(colors.length)
  })

  it('leaves a monochrome icon agent in the text color', () => {
    expect(botAgentNameColor('codex')).toBeUndefined()
    expect(botAgentNameColor(undefined)).toBeUndefined()
  })
})
