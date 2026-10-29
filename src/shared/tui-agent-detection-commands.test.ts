import { describe, expect, it } from 'vitest'
import {
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedPiRuntimes,
  resolveDetectedTuiAgentIds
} from './tui-agent-detection-commands'

describe('resolveDetectedPiRuntimes', () => {
  it('names both Pi runtimes when both binaries resolve, while the agent ids fold them into pi', () => {
    const found = new Set(['pi', 'gentle-shell'])
    expect(resolveDetectedPiRuntimes(KNOWN_TUI_AGENT_DETECTION_COMMANDS, found, 'linux')).toEqual([
      'pi',
      'gentle-shell'
    ])
    expect(resolveDetectedTuiAgentIds(KNOWN_TUI_AGENT_DETECTION_COMMANDS, found, 'linux')).toEqual([
      'pi'
    ])
  })

  it('names only Gentle Shell when only its binary resolves', () => {
    const found = new Set(['gentle-shell'])
    expect(resolveDetectedPiRuntimes(KNOWN_TUI_AGENT_DETECTION_COMMANDS, found, 'linux')).toEqual([
      'gentle-shell'
    ])
    expect(resolveDetectedTuiAgentIds(KNOWN_TUI_AGENT_DETECTION_COMMANDS, found, 'linux')).toEqual([
      'pi'
    ])
  })

  it('names only stock Pi when only the pi binary resolves', () => {
    expect(
      resolveDetectedPiRuntimes(KNOWN_TUI_AGENT_DETECTION_COMMANDS, new Set(['pi']), 'linux')
    ).toEqual(['pi'])
  })

  it('names nothing when neither binary resolves, and ignores other agents', () => {
    expect(
      resolveDetectedPiRuntimes(KNOWN_TUI_AGENT_DETECTION_COMMANDS, new Set(['claude']), 'linux')
    ).toEqual([])
  })
})
