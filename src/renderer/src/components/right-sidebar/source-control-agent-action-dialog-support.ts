import { useMemo } from 'react'
import type { PiDisplayRuntime } from '@/lib/pi-agent-display'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { getAgentDisplayLabel } from '@/lib/agent-catalog'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { SourceControlAiWriteTarget } from '../../../../shared/source-control-ai-recipe-save'
import { translate } from '@/i18n/i18n'
import type { SourceControlAgentActionDeliveryPlanState } from './SourceControlAgentActionDialogForm'
import type { SourceControlAgentScopeNote } from './source-control-agent-action-dialog-result'

/** The agent scope note for the launch, read with the workspace's Pi runtime. */
export function useSourceControlAgentScopeNote(
  launchAgentScope: Parameters<typeof buildSourceControlAgentScopeNote>[0]
): SourceControlAgentScopeNote | null {
  const piRuntime = usePiDisplayRuntime()
  return useMemo(
    () => buildSourceControlAgentScopeNote(launchAgentScope, piRuntime),
    [launchAgentScope, piRuntime]
  )
}

export function isSourceControlAgentDetectedAndEnabled(
  agent: TuiAgent | null,
  detectedAgents: TuiAgent[],
  disabledAgents: TuiAgent[] | undefined
): boolean {
  return Boolean(
    agent && detectedAgents.includes(agent) && isTuiAgentEnabled(agent, disabledAgents)
  )
}

export function buildSourceControlAgentSaveTargets(repoId?: string | null): {
  value: string
  label: string
}[] {
  const targets = [
    {
      value: 'none',
      label: translate(
        'auto.components.right.sidebar.SourceControlAgentActionDialog.994cddd1f7',
        "Don't save"
      )
    }
  ]
  if (repoId) {
    targets.push({
      value: 'repo',
      label: translate(
        'auto.components.right.sidebar.SourceControlAgentActionDialog.808cfe0a3b',
        'This repository'
      )
    })
  }
  targets.push({
    value: 'global',
    label: translate(
      'auto.components.right.sidebar.SourceControlAgentActionDialog.38b899cc02',
      'All repositories'
    )
  })
  return targets
}

export function getDefaultSourceControlAgentSaveTargetValue(): string {
  return 'global'
}

export function buildSourceControlAgentConnectionErrorPlan(): SourceControlAgentActionDeliveryPlanState {
  return {
    status: 'error',
    error: translate(
      'auto.components.right.sidebar.SourceControlAgentActionDialog.c075d00de1',
      'Unable to resolve the workspace connection.'
    )
  }
}

export function resolveSourceControlAgentSaveTarget(
  saveTargetValue: string,
  repoId?: string | null
): SourceControlAiWriteTarget | null {
  if (saveTargetValue === 'repo' && repoId) {
    return { type: 'repo', repoId }
  }
  if (saveTargetValue === 'global') {
    return { type: 'global' }
  }
  return null
}

export function buildSourceControlAgentStatusCopy(args: {
  selectedAgent: TuiAgent | null
  selectedAgentUnavailable: boolean
  connectionUnavailable: boolean
  hasEnabledAgents: boolean
  detecting: boolean
  piRuntime: PiDisplayRuntime
}): string | null {
  const {
    selectedAgent,
    selectedAgentUnavailable,
    connectionUnavailable,
    hasEnabledAgents,
    detecting
  } = args
  if (selectedAgentUnavailable) {
    return `${selectedAgent ? getAgentDisplayLabel(selectedAgent, args.piRuntime) : ''} is not enabled or was not detected on this workspace host.`
  }
  if (connectionUnavailable) {
    return 'Unable to resolve the workspace connection.'
  }
  if (!hasEnabledAgents && !detecting) {
    return 'No enabled agents were detected on this workspace host.'
  }
  return null
}

/** Names the agent this action will really use when the repo overrides the global default. */
export function buildSourceControlAgentScopeNote(
  launchAgentScope: {
    overridesGlobalAgent: boolean
    effectiveAgentId: TuiAgent | null
    globalAgentId: TuiAgent | null
  },
  piRuntime: PiDisplayRuntime
): SourceControlAgentScopeNote | null {
  if (!launchAgentScope.overridesGlobalAgent) {
    return null
  }
  const labelFor = (agentId: TuiAgent | null): string =>
    agentId ? getAgentDisplayLabel(agentId, piRuntime) : ''
  return {
    effectiveAgentLabel: labelFor(launchAgentScope.effectiveAgentId),
    globalAgentLabel: labelFor(launchAgentScope.globalAgentId)
  }
}
