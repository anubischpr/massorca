import { describe, expect, it } from 'vitest'
import { getDictationUnavailableReason } from './dictation-unavailable-reason'
import { getDefaultVoiceSettings } from '../../../../shared/constants'

const base = getDefaultVoiceSettings()

describe('getDictationUnavailableReason', () => {
  it('reports off, missing model, and missing cloud key in that order', () => {
    expect(getDictationUnavailableReason(undefined)).toBe('off')
    expect(getDictationUnavailableReason(base)).toBe('off')
    expect(getDictationUnavailableReason({ ...base, enabled: true })).toBe('no-model')
    expect(
      getDictationUnavailableReason({
        ...base,
        enabled: true,
        sttModel: 'openai-gpt-4o-transcribe'
      })
    ).toBe('missing-api-key')
  })

  it('is available with a local model or a configured cloud key', () => {
    expect(
      getDictationUnavailableReason({
        ...base,
        enabled: true,
        sttModel: 'whisper-tiny'
      })
    ).toBeNull()
    expect(
      getDictationUnavailableReason({
        ...base,
        enabled: true,
        sttModel: 'openai-gpt-4o-transcribe',
        openAiApiKeyConfigured: true
      })
    ).toBeNull()
  })
})
