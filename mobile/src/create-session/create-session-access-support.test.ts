import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createSessionAccessSupport } from './create-session-access-support'

function declared(file: string, key: string): string[] {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const start = source.indexOf('[', source.indexOf(`${key}:`))
  const list = source.slice(start + 1, source.indexOf(']', start))
  return list
    .split(',')
    .map((entry) => entry.trim().replaceAll("'", ''))
    .filter(Boolean)
}

describe('createSessionAccessSupport', () => {
  it.each([
    ['claude', '../../../src/main/claude/claude-structured-agent-definition.ts'],
    ['codex', '../../../src/main/codex/codex-structured-agent-definition.ts']
  ])('mirrors what %s declares to the host', (agent, file) => {
    const support = createSessionAccessSupport(agent)
    expect(support?.modes).toEqual(declared(file, 'supportedAccessModes'))
    expect(support?.presets).toEqual(declared(file, 'supportedPermissionPresets'))
  })

  it('offers nothing for an agent the phone cannot vouch for', () => {
    expect(createSessionAccessSupport('gemini')).toBeNull()
    expect(createSessionAccessSupport(null)).toBeNull()
  })
})
