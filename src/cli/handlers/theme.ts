import type { GlobalSettings } from '../../shared/global-settings-types'
import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'

type Theme = GlobalSettings['theme']
type ThemeResult = { theme: Theme }

const THEMES: readonly Theme[] = ['light', 'dark', 'system']

function isTheme(value: string): value is Theme {
  return THEMES.some((theme) => theme === value)
}

const formatTheme = (result: ThemeResult): string => `theme: ${result.theme}`

export const THEME_HANDLERS: Record<string, CommandHandler> = {
  'theme get': async ({ client, json }) => {
    printResult(await client.call<ThemeResult>('appearance.getTheme'), json, formatTheme)
  },
  'theme set': async ({ client, json, flags }) => {
    const theme = getRequiredStringFlag(flags, 'theme')
    if (!isTheme(theme)) {
      throw new RuntimeClientError('invalid_argument', 'Theme must be light, dark or system')
    }
    printResult(await client.call<ThemeResult>('appearance.setTheme', { theme }), json, formatTheme)
  }
}
