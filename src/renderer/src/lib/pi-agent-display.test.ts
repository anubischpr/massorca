import { describe, expect, it } from 'vitest'
import { agentBrandRowAttribute, piRuntimeLabel, resolvePiDisplayRuntime } from './pi-agent-display'

describe('piRuntimeLabel', () => {
  it('names Gentle Shell, stock Pi, or the neutral label while unknown', () => {
    expect(piRuntimeLabel('gentle-shell')).toBe('Gentle Shell')
    expect(piRuntimeLabel('pi')).toBe('Pi')
    expect(piRuntimeLabel('unknown')).toBe('Pi / Gentle Shell')
  })
})

describe('resolvePiDisplayRuntime', () => {
  it('stays unknown while no evidence names a runtime', () => {
    expect(resolvePiDisplayRuntime({})).toBe('unknown')
    expect(resolvePiDisplayRuntime({ command: '   ' })).toBe('unknown')
  })

  it('reads the host-reported Gentle Shell when no client command is set', () => {
    expect(resolvePiDisplayRuntime({ hostAnswer: 'gentle-shell' })).toBe('gentle-shell')
  })

  it('reads the host-reported stock Pi', () => {
    expect(resolvePiDisplayRuntime({ hostAnswer: 'pi' })).toBe('pi')
  })

  it('stays unknown when the host has not answered or has no Pi installed', () => {
    expect(resolvePiDisplayRuntime({ hostAnswer: 'unknown' })).toBe('unknown')
    expect(resolvePiDisplayRuntime({ hostAnswer: 'cliMissing' })).toBe('unknown')
  })

  it('lets a client command that names stock Pi win over a host Gentle Shell answer', () => {
    expect(resolvePiDisplayRuntime({ command: 'pi', hostAnswer: 'gentle-shell' })).toBe('pi')
  })

  it('reads a configured gentle-shell command without waiting for the host', () => {
    expect(resolvePiDisplayRuntime({ command: 'gentle-shell' })).toBe('gentle-shell')
  })

  it("prefers the chat's recorded runtime over the host answer", () => {
    expect(resolvePiDisplayRuntime({ hostRecorded: 'gentle-shell', hostAnswer: 'pi' })).toBe(
      'gentle-shell'
    )
  })

  it('reads a Gentle Shell session transcript as Gentle Shell', () => {
    expect(
      resolvePiDisplayRuntime({ transcriptPath: '/home/u/.gentle-shell/sessions/a.jsonl' })
    ).toBe('gentle-shell')
  })
})

describe('agentBrandRowAttribute', () => {
  it('marks only the Pi row when it runs Gentle Shell', () => {
    expect(agentBrandRowAttribute('pi', 'gentle-shell')).toBe('gentle-shell')
    expect(agentBrandRowAttribute('pi', 'pi')).toBeUndefined()
    expect(agentBrandRowAttribute('pi', 'unknown')).toBeUndefined()
    expect(agentBrandRowAttribute('codex', 'gentle-shell')).toBeUndefined()
  })
})
