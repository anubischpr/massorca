import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { CreateSessionBaseRefSheet } from './CreateSessionBaseRefSheet'
import { CreateSessionChoiceSheet } from './CreateSessionChoiceSheet'
import { CreateSessionMoreSheet, type CreateSessionMoreAction } from './CreateSessionMoreSheet'
import { createSessionAgentChoiceValue } from './create-session-agent-choices'
import type { CreateSessionController } from './use-create-session-controller'

export type CreateSessionSheet = 'host' | 'project' | 'mode' | 'baseRef' | 'agent' | 'more' | null

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
        searchable
        emptyMessage="No project is set up on this computer yet. Add one from the desktop app."
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
      <CreateSessionBaseRefSheet
        visible={sheet === 'baseRef'}
        source={controller.baseRefSource}
        selected={selection?.baseRef ?? null}
        onSelect={(baseRef) => {
          controller.chooseBaseRef(baseRef)
          close()
        }}
        onClose={close}
      />
      <CreateSessionChoiceSheet
        visible={sheet === 'agent'}
        title="Agent"
        hint={
          controller.agentsDetected
            ? hostLabel
              ? `Agents found on ${hostLabel}`
              : undefined
            : 'Looking for agents on this computer…'
        }
        rows={controller.agentChoices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          description: '',
          leading: (
            <MobileAgentIcon
              agentId={choice.agent}
              piRuntime={choice.piRuntime ?? undefined}
              size={18}
            />
          )
        }))}
        searchable
        emptyMessage="No agent found on this computer. Install one, then reopen this screen."
        selectedValue={
          selection?.agent
            ? createSessionAgentChoiceValue(selection.agent, selection.piRuntime)
            : null
        }
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
