import type { VoiceSettings } from '../../../../shared/speech-types'
import { translate } from '@/i18n/i18n'

export type DictationUnavailableReason = 'off' | 'no-model' | 'missing-api-key'

// Cloud model ids are the only ones that need a key; the renderer has no sync catalog.
const OPENAI_MODEL_ID_PREFIX = 'openai-'

export function getDictationUnavailableReason(
  voice: VoiceSettings | null | undefined
): DictationUnavailableReason | null {
  if (voice?.enabled !== true) {
    return 'off'
  }
  if (!voice.sttModel) {
    return 'no-model'
  }
  if (voice.sttModel.startsWith(OPENAI_MODEL_ID_PREFIX) && !voice.openAiApiKeyConfigured) {
    return 'missing-api-key'
  }
  return null
}

export function dictationUnavailableHint(reason: DictationUnavailableReason): string {
  switch (reason) {
    case 'off':
      return translate(
        'components.native-chat.composer.dictationOff',
        'Turn on dictation in Settings › Voice'
      )
    case 'no-model':
      return translate(
        'components.native-chat.composer.dictationNoModel',
        'Choose and download a speech model in Settings › Voice'
      )
    case 'missing-api-key':
      return translate(
        'components.native-chat.composer.dictationNoApiKey',
        'Add your OpenAI API key in Settings › Voice to use this speech model'
      )
  }
}
