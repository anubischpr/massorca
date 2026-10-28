import { CreateSessionChoiceSheet, type CreateSessionSheetRow } from './CreateSessionChoiceSheet'

export type CreateSessionMoreAction = 'advanced' | 'terminal'

const ROWS: readonly CreateSessionSheetRow[] = [
  {
    value: 'advanced',
    label: 'Name, branch and setup script',
    description: 'Opens the full worktree form',
    chevron: true
  },
  {
    value: 'terminal',
    label: 'Blank terminal',
    description: 'A shell with no agent',
    chevron: true
  },
  {
    // Why: standalone chats are created by desktop-only IPC, so the phone cannot start one.
    value: 'standalone',
    label: 'Work without a project',
    description: 'Only from the computer for now',
    disabled: true
  }
]

/** The rarely needed ways to start: the full form, a bare shell, and the one the phone cannot do. */
export function CreateSessionMoreSheet({
  visible,
  terminalDisabled,
  onPick,
  onClose
}: {
  visible: boolean
  /** No project to open a terminal in yet. */
  terminalDisabled: boolean
  onPick: (action: CreateSessionMoreAction) => void
  onClose: () => void
}): React.JSX.Element {
  const rows = ROWS.map((row) =>
    row.value === 'terminal' && terminalDisabled ? { ...row, disabled: true } : row
  )
  return (
    <CreateSessionChoiceSheet
      visible={visible}
      title="More options"
      rows={rows}
      onSelect={(value) => {
        if (value === 'advanced' || value === 'terminal') {
          onPick(value)
        }
      }}
      onClose={onClose}
    />
  )
}
