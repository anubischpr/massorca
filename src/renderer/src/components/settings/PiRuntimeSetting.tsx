import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SettingsRow } from './SettingsFormControls'
import { translate } from '@/i18n/i18n'

export function PiRuntimeSetting({
  settings,
  updateSettings,
  refresh
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
  refresh: () => Promise<unknown>
}): React.JSX.Element {
  const command = settings.agentCmdOverrides?.pi?.trim() ?? ''
  const gentleShell = /(?:^|[/\\])gentle-shell(?:\.(?:cmd|bat|exe))?$/i.test(command)
  const custom = command !== '' && command !== 'pi' && !gentleShell
  return (
    <SettingsRow
      label={translate('settings.agents.piRuntime', 'Pi runtime')}
      description={translate(
        'settings.agents.piRuntimeDescription',
        'Choose stock Pi or Gentle Shell. Both use Pi chat sessions; command paths can be customized below.'
      )}
      control={
        <Select
          value={custom ? 'custom' : gentleShell ? 'gentle-shell' : 'pi'}
          onValueChange={(value) => {
            if (value !== 'pi' && value !== 'gentle-shell') {
              return
            }
            const overrides = { ...settings.agentCmdOverrides }
            if (value === 'pi') {
              delete overrides.pi
            } else {
              overrides.pi = 'gentle-shell'
            }
            void Promise.resolve(updateSettings({ agentCmdOverrides: overrides })).then(() =>
              refresh()
            )
          }}
        >
          <SelectTrigger aria-label={translate('settings.agents.piRuntime', 'Pi runtime')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pi">Pi</SelectItem>
            <SelectItem value="gentle-shell">Gentle Shell</SelectItem>
            {custom && (
              <SelectItem value="custom">
                {translate('settings.agents.customCommand', 'Custom command')}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      }
    />
  )
}
