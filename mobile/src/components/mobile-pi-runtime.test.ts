import { describe, expect, it } from 'vitest'
import {
  mobilePiAgentLabel,
  mobilePiRuntimeFromMarker,
  mobilePiRuntimeFromTranscriptPath
} from './mobile-pi-runtime'

describe('mobilePiRuntimeFromMarker', () => {
  it('reads Gentle Shell from the host marker', () => {
    expect(mobilePiRuntimeFromMarker({ piRuntime: 'gentle-shell' })).toBe('gentle-shell')
  })

  it('keeps the stock Pi identity for stock rows and hosts that never send the marker', () => {
    expect(mobilePiRuntimeFromMarker({})).toBe('pi')
    expect(mobilePiRuntimeFromMarker({ piRuntime: undefined })).toBe('pi')
    expect(mobilePiRuntimeFromMarker({ piRuntime: 'future-pi' })).toBe('pi')
  })
})

describe('mobilePiRuntimeFromTranscriptPath', () => {
  it('reads Gentle Shell from its session home on either path separator', () => {
    expect(
      mobilePiRuntimeFromTranscriptPath('C:\\Users\\ada\\.gentle-shell\\agent\\sessions\\s.jsonl')
    ).toBe('gentle-shell')
    expect(mobilePiRuntimeFromTranscriptPath('/home/ada/.gentle-shell/agent/s.jsonl')).toBe(
      'gentle-shell'
    )
  })

  it('reads stock Pi, a missing path, and a null path as stock Pi', () => {
    expect(mobilePiRuntimeFromTranscriptPath('/home/ada/.pi/agent/s.jsonl')).toBe('pi')
    expect(mobilePiRuntimeFromTranscriptPath(undefined)).toBe('pi')
    expect(mobilePiRuntimeFromTranscriptPath(null)).toBe('pi')
  })
})

describe('mobilePiAgentLabel', () => {
  it('names each Pi runtime the way the desktop row does', () => {
    expect(mobilePiAgentLabel('gentle-shell')).toBe('Gentle Shell')
    expect(mobilePiAgentLabel('pi')).toBe('Pi')
  })
})
