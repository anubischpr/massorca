import { describe, expect, it } from 'vitest'
import { piRuntimeFromCommand, piRuntimeLabel } from './pi-agent-display'

describe('piRuntimeFromCommand', () => {
  it('names Gentle Shell for a gentle-shell command, bare or as a path', () => {
    expect(piRuntimeFromCommand('gentle-shell')).toBe('gentle-shell')
    expect(piRuntimeFromCommand('/home/user/.local/bin/gentle-shell')).toBe('gentle-shell')
  })

  it('names stock Pi for a pi command or when no command is set', () => {
    expect(piRuntimeFromCommand('pi')).toBe('pi')
    expect(piRuntimeFromCommand(undefined)).toBe('pi')
    expect(piRuntimeFromCommand('')).toBe('pi')
  })
})

describe('piRuntimeLabel', () => {
  it('reads Gentle Shell for the Gentle Shell runtime', () => {
    expect(piRuntimeLabel('gentle-shell')).toBe('Gentle Shell')
  })

  it('reads Pi for the stock runtime', () => {
    expect(piRuntimeLabel('pi')).toBe('Pi')
  })

  it('keeps the neutral combined label before settings load', () => {
    expect(piRuntimeLabel('unknown')).toBe('Pi / Gentle Shell')
  })
})
