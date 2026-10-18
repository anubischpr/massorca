import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { SettingsSwitchRow } from './SettingsFormControls'
import { Card, CardContent } from '../ui/card'
import { SearchableSetting } from './SearchableSetting'
import { getChatReplySuggestionsSearchEntry } from './chat-reply-suggestions-search'

type NativeChatReplySuggestionsSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  forceVisible?: boolean
}

export function NativeChatReplySuggestionsSetting({
  settings,
  updateSettings,
  forceVisible = false
}: NativeChatReplySuggestionsSettingProps): React.JSX.Element {
  const enabled = settings.nativeChatReplySuggestions !== false
  const emulated = settings.nativeChatEmulatedReplySuggestions !== false
  const entry = getChatReplySuggestionsSearchEntry()
  return (
    <SearchableSetting
      {...entry}
      id="chat-reply-suggestions"
      forceVisible={forceVisible}
      className="max-w-none"
    >
      <Card>
        <CardContent>
          <div className="space-y-3">
            <SettingsSwitchRow
              label={entry.title}
              description={entry.description}
              checked={enabled}
              ariaLabel={translate(
                'components.settings.nativeChat.replySuggestionsToggleLabel',
                'Toggle reply suggestions'
              )}
              onChange={() => updateSettings({ nativeChatReplySuggestions: !enabled })}
            />
            {enabled ? (
              <SettingsSwitchRow
                label={translate(
                  'components.settings.nativeChat.emulatedReplySuggestionsTitle',
                  'Suggest replies for agents without their own'
                )}
                description={translate(
                  'components.settings.nativeChat.emulatedReplySuggestionsCopy',
                  "Ask a model for the suggestion when the agent does not offer one. Each suggestion costs one short model call on the machine the chat runs on, using the agent's own account."
                )}
                checked={emulated}
                ariaLabel={translate(
                  'components.settings.nativeChat.emulatedReplySuggestionsToggleLabel',
                  'Toggle suggestions for agents without their own'
                )}
                onChange={() => updateSettings({ nativeChatEmulatedReplySuggestions: !emulated })}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </SearchableSetting>
  )
}
