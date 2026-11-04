import { translate } from '@/i18n/i18n'
import type { PrototypeAgent } from '../../../../shared/prototype-request'
import type { PrototypeStatus } from '../../../../shared/prototype-list-model'
import type { PrototypeListedDesignSystem } from '../../../../shared/rpc-contract/prototype-params'

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

/** The count alone, as the viewer header shows it: "3 directions" or "1 screen". */
export function prototypeCountLabel(status: PrototypeStatus): string {
  if (status.kind === 'single') {
    return translate('components.prototypes.statusScreen', '1 screen')
  }
  return translate('components.prototypes.statusCount', '{{count}} directions', {
    count: status.count
  })
}

/** The design system row's line: its status, version and token count, or that it waits for review. */
export function prototypeSystemLine(
  system: Pick<PrototypeListedDesignSystem, 'status' | 'version' | 'tokenCount'>
): string {
  if (system.status === 'proposed') {
    return translate('components.prototypes.list.systemProposed', 'Proposed · needs review')
  }
  return translate(
    'components.prototypes.list.systemDetected',
    'Detected · v{{version}} · {{count}} tokens',
    { version: system.version, count: system.tokenCount }
  )
}

/** The suffix a set row shows when the set was built on a design system version. */
export function prototypeBuiltOnLabel(version: number): string {
  return translate('components.prototypes.list.builtOn', 'built on v{{version}}', { version })
}

export function prototypeArchivedHeading(): string {
  return translate('components.prototypes.archived.heading', 'Archived')
}

export function prototypeArchiveLabel(): string {
  return translate('components.prototypes.archived.archive', 'Archive')
}

export function prototypeUnarchiveLabel(): string {
  return translate('components.prototypes.archived.unarchive', 'Unarchive')
}

export function prototypeDeleteLabel(): string {
  return translate('components.prototypes.archived.delete', 'Delete')
}

/** The accessible name of a set row's menu button. */
export function prototypeSetActionsLabel(title: string): string {
  return translate('components.prototypes.archived.rowActions', 'Actions for {{title}}', { title })
}

export function prototypeDeleteDialogTitle(): string {
  return translate('components.prototypes.archived.deleteTitle', 'Delete this prototype set?')
}

export function prototypeDeleteDialogBody(title: string): string {
  return translate(
    'components.prototypes.archived.deleteBody',
    'This removes the files of "{{title}}" from this computer. Its chat or worktree is already gone, and this cannot be undone.',
    { title }
  )
}

export function prototypeDeleteCancelLabel(): string {
  return translate('components.prototypes.archived.deleteCancel', 'Cancel')
}
