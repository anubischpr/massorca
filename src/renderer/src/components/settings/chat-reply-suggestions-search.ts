import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import type { SettingsSearchEntry } from './settings-search'

export const getChatReplySuggestionsSearchEntry = createLocalizedCatalog(
  (): SettingsSearchEntry => ({
    targetSectionId: 'chat-reply-suggestions',
    title: translate('components.settings.nativeChat.replySuggestionsTitle', 'Reply suggestions'),
    description: translate(
      'components.settings.nativeChat.replySuggestionsCopy',
      'After the agent finishes a turn, show a suggested next message as ghost text in the empty message box. Press Tab to accept it or Esc to dismiss it.'
    ),
    keywords: [
      translate(
        'components.settings.nativeChat.emulatedReplySuggestionsTitle',
        'Suggest replies for agents without their own'
      )
    ]
  })
)
