import { translate } from '@/i18n/i18n'
import type { PrototypeAgent } from '../../../../shared/prototype-request'
import type { PrototypeFilter, PrototypeStatus } from './prototype-list-model'

// Every translated string of the Prototypes view. Keys are literal so the extraction check sees them.

export function prototypeAgentLabel(agent: PrototypeAgent): string {
  switch (agent) {
    case 'claude':
      return translate('components.prototypes.agent.claude', 'Claude')
    case 'codex':
      return translate('components.prototypes.agent.codex', 'Codex')
    case 'antigravity':
      return translate('components.prototypes.agent.antigravity', 'Antigravity')
    case 'gentle-shell':
      return translate('components.prototypes.agent.gentleShell', 'Gentle Shell')
    case 'other':
      return translate('components.prototypes.agent.other', 'Other')
  }
}

export function prototypeFilterLabel(filter: PrototypeFilter): string {
  switch (filter) {
    case 'all':
      return translate('components.prototypes.filter.all', 'All')
    case 'claude':
      return translate('components.prototypes.filter.claude', 'Claude')
    case 'codex':
      return translate('components.prototypes.filter.codex', 'Codex')
    case 'antigravity':
      return translate('components.prototypes.filter.stitch', 'Stitch')
    case 'gentle-shell':
      return translate('components.prototypes.filter.gentleShell', 'Gentle Shell')
  }
}

export function prototypeStatusLabel(status: PrototypeStatus): string {
  if (status.kind === 'single') {
    return translate('components.prototypes.statusScreen', '1 screen')
  }
  return translate(
    'components.prototypes.statusDirections',
    '{{count}} directions · iterating {{letter}}',
    { count: status.count, letter: status.iterating }
  )
}
