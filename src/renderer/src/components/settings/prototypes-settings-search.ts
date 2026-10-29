import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getPrototypesSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('components.prototypes.settings.alternatives', 'Alternatives per request'),
    description: translate(
      'components.prototypes.settings.description',
      'How many directions an agent makes when you ask for a prototype.'
    ),
    keywords: [
      ...translateSearchKeyword('components.prototypes.settings.keywordPrototype', 'prototype', {
        aliases: ['prototypes', 'prototipo', 'mockup', 'wireframe', 'directions']
      })
    ]
  }
])
