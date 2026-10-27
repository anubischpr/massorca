import { CreateSessionChoiceSheet } from './CreateSessionChoiceSheet'
import { CreateSessionMoreSheet, type CreateSessionMoreAction } from './CreateSessionMoreSheet'
import type { CreateSessionController } from './use-create-session-controller'

export type CreateSessionSheet = 'host' | 'project' | 'mode' | 'agent' | 'more' | null

/** Every picker the chips and the top bar open, driven by one `sheet` value. */
export function CreateSessionSheets({
  controller,
  sheet,
  onSheetChange,
  onMore
}: {
  controller: CreateSessionController
  sheet: CreateSessionSheet
  onSheetChange: (sheet: CreateSessionSheet) => void
  onMore: (action: CreateSessionMoreAction) => void
}): React.JSX.Element {
  const { selection, hostLabel } = controller
  const close = (): void => onSheetChange(null)
  return (
    <>
      <CreateSessionChoiceSheet
        visible={sheet === 'host'}
        title="Run on"
        rows={controller.hostOptions.map((option) => ({
          value: option.id,
          label: option.label,
          description: option.detail
        }))}
        selectedValue={selection?.hostId}
        onSelect={(value) => {
          controller.chooseHost(value)
          close()
        }}
        onClose={close}
      />
      <CreateSessionChoiceSheet
        visible={sheet === 'project'}
        title="Project"
        hint={hostLabel ? `Projects on ${hostLabel}` : undefined}
        rows={controller.projectChoices}
        selectedValue={selection?.repoId}
        onSelect={(value) => {
          controller.chooseProject(value)
          close()
        }}
        onClose={close}
      />
      <CreateSessionChoiceSheet
        visible={sheet === 'mode'}
        title="Workspace"
        rows={controller.workspaceChoices}
        selectedValue={selection?.workspaceMode}
        onSelect={(value) => {
          controller.chooseWorkspaceMode(value)
          close()
        }}
        onClose={close}
      />
      <CreateSessionChoiceSheet
        visible={sheet === 'agent'}
        title="Agent"
        hint={hostLabel ? `Agents found on ${hostLabel}` : undefined}
        rows={controller.agentChoices}
        selectedValue={selection?.agent}
        onSelect={(value) => {
          controller.chooseAgent(value)
          close()
        }}
        onClose={close}
      />
      <CreateSessionMoreSheet
        visible={sheet === 'more'}
        terminalDisabled={controller.repo === null}
        onPick={(action) => {
          close()
          onMore(action)
        }}
        onClose={close}
      />
    </>
  )
}
