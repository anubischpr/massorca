import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { AgentIcon, getAgentDisplayLabel } from '@/lib/agent-catalog'
import type { PiDisplayRuntime } from '@/lib/pi-agent-display'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { nativeChatSessionChoiceLabel } from '../native-chat/native-chat-session-option-labels'
import { CreateChatChipMenu, type CreateChatMenuGroup } from './CreateChatChipMenu'
import {
  DEFAULT_MODEL_MENU_VALUE,
  buildAgentMenuItems,
  buildEffortMenuItems,
  buildModelMenuItems
} from './create-chat-menu-items'
import type { CreateChatSelection } from './create-chat-selection'
import type { CreateChatModelCatalog } from './use-create-chat-model-catalog'

type AgentChipProps = {
  selection: CreateChatSelection
  /** Chat-capable agents on the selected host, in launch order. */
  agents: readonly TuiAgent[]
  piRuntime: PiDisplayRuntime
  catalog: CreateChatModelCatalog
  onSelectionChange: (next: CreateChatSelection) => void
}

/** The agent, with the model and effort it launches with, as one chip. */
export function CreateChatAgentChip({
  selection,
  agents,
  piRuntime,
  catalog,
  onSelectionChange
}: AgentChipProps): React.JSX.Element {
  const { models } = catalog
  const [open, setOpen] = useState(false)
  // Why: an agent picked in this open menu whose catalog has not answered, so the menu cannot yet
  // tell whether the pick still has a model to choose.
  const [awaitingAgent, setAwaitingAgent] = useState<TuiAgent | null>(null)

  // Derived while rendering rather than in an effect, so the menu never shows a stale step.
  if (awaitingAgent !== null && awaitingAgent === selection.agent && catalog.status !== 'loading') {
    setAwaitingAgent(null)
    // An agent with no model or effort to choose is complete once picked.
    if (catalog.status === 'none') {
      setOpen(false)
    }
  }

  const agentLabel = getAgentDisplayLabel(selection.agent, piRuntime)
  const activeModel =
    models.find((model) => model.id === selection.model) ??
    models.find((model) => model.isDefault) ??
    models[0]
  const efforts = activeModel?.efforts ?? []
  const modelLabel = selection.model
    ? models.find((model) => model.id === selection.model)?.label
    : undefined
  const effortValue = selection.effort ?? activeModel?.defaultEffort
  const effortLabel = efforts.find((effort) => effort.value === effortValue)
  const label = [
    agentLabel,
    modelLabel,
    effortLabel ? nativeChatSessionChoiceLabel(effortLabel) : undefined
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ')

  const groups: CreateChatMenuGroup[] = [
    {
      key: 'agent',
      title: translate('components.createChat.agentGroup', 'Agent'),
      value: selection.agent,
      items: buildAgentMenuItems(agents, piRuntime, (agent) => (
        <AgentIcon agent={agent} size={14} />
      )),
      onValueChange: (value) => {
        const agent = agents.find((candidate) => candidate === value)
        if (agent) {
          setAwaitingAgent(agent !== selection.agent ? agent : null)
          onSelectionChange({ ...selection, agent, model: undefined, effort: undefined })
        }
      },
      // Why: re-picking the current agent has an answered catalog; a new one has not been asked yet.
      keepOpenAfter: (value) => value !== selection.agent || catalog.status !== 'none'
    }
  ]
  if (models.length > 0) {
    groups.push({
      key: 'model',
      title: translate('components.createChat.modelGroup', 'Model'),
      value: selection.model ?? DEFAULT_MODEL_MENU_VALUE,
      items: buildModelMenuItems(models),
      onValueChange: (value) => {
        const next = models.find((model) => model.id === value)
        onSelectionChange({
          ...selection,
          model: next?.id,
          effort: undefined
        })
      },
      keepOpenAfter: (value) =>
        ((models.find((model) => model.id === value) ?? models.find((model) => model.isDefault))
          ?.efforts?.length ?? 0) > 0
    })
  } else {
    groups.push({
      key: 'model',
      title: translate('components.createChat.modelGroup', 'Model'),
      value: '',
      items: [],
      onValueChange: () => {},
      placeholder:
        catalog.status === 'loading'
          ? translate('components.createChat.modelLoading', 'Loading models…')
          : translate('components.createChat.modelSetByAgent', 'Model set by the agent')
    })
  }
  if (efforts.length > 0) {
    groups.push({
      key: 'effort',
      title: translate('components.createChat.effortGroup', 'Effort'),
      value: effortValue ?? '',
      items: buildEffortMenuItems(efforts),
      onValueChange: (value) => {
        const effort = efforts.find((candidate) => candidate.value === value)
        if (effort) {
          onSelectionChange({ ...selection, effort: effort.value })
        }
      }
    })
  }

  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.agentAria', 'Agent, model and effort')}
      label={label}
      icon={<AgentIcon agent={selection.agent} size={14} />}
      note={
        agents.length === 0
          ? translate('components.createChat.noAgents', 'No agents detected yet.')
          : undefined
      }
      groups={groups}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setAwaitingAgent(null)
        }
      }}
    />
  )
}
