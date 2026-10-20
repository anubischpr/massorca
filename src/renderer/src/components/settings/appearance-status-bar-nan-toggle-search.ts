import type { StatusBarItem } from '../../../../shared/ui-chrome-types'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export function getNanStatusBarToggleSearchEntry(): {
  id: StatusBarItem
  title: string
  description: string
  keywords: string[]
  toggleDescription: string
} {
  return {
    id: 'nan',
    title: translate('auto.components.settings.appearance.search.nanUsageTitle', 'NaN Usage'),
    description: translate(
      'auto.components.settings.appearance.search.nanUsageDescription',
      'Show NaN Builders subscription usage for Gentle Shell in the status bar.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.896eb53fd4',
        'status bar'
      ),
      ...translateSearchKeyword('auto.components.settings.appearance.search.nan', 'nan'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.00a028f25f', 'usage'),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.gentleShell',
        'gentle shell'
      )
    ],
    toggleDescription: translate(
      'settings.appearance.statusBar.nanToggleDescription',
      'Show NaN Builders subscription usage.'
    )
  }
}
