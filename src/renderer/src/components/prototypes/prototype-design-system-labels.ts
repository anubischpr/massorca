import { translate } from '@/i18n/i18n'
import type { DesignSystemStatus } from '../../../../shared/prototype-design-system-tokens'

// Every translated string of the Design system view that is a word rather than a sentence. Keys are literal
// so the extraction check sees them.

export function designSystemStatusWord(status: DesignSystemStatus): string {
  return status === 'proposed'
    ? translate('components.prototypes.designSystem.statusProposed', 'proposed')
    : translate('components.prototypes.designSystem.statusDetected', 'detected')
}

/** The label of one kind chip in the add panel; the English kind is what the draft names. */
export function addChoiceLabel(choice: string): string {
  switch (choice) {
    case 'Badge':
      return translate('components.prototypes.designSystem.chipBadge', 'Badge')
    case 'Modal':
      return translate('components.prototypes.designSystem.chipModal', 'Modal')
    case 'Table':
      return translate('components.prototypes.designSystem.chipTable', 'Table')
    case 'Toast':
      return translate('components.prototypes.designSystem.chipToast', 'Toast')
    case 'Avatar':
      return translate('components.prototypes.designSystem.chipAvatar', 'Avatar')
    case 'Toggle':
      return translate('components.prototypes.designSystem.chipToggle', 'Toggle')
    default:
      return choice
  }
}
