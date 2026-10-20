import {
  antigravitySelectionForPicker,
  groupAntigravityModelVariants
} from '../../shared/antigravity-model-variants'
import type { StructuredAgentDefinition } from '../native-chat/agent-session-wire/structured-agent-definition'

export const ANTIGRAVITY_STRUCTURED_AGENT: StructuredAgentDefinition = {
  agent: 'antigravity',
  handleTransport: 'antigravity-stream-json',
  accountLocatorKind: 'antigravity',
  capabilities: {
    rewind: false,
    compact: false,
    threadGoal: false,
    contextUsage: true,
    imagePrompts: false,
    steering: 'queue',
    approvalEnforcement: 'provider',
    supportedAccessModes: ['default', 'full-access'],
    supportedPermissionPresets: ['auto', 'accept-edits', 'plan']
  },
  restingOptions: {
    acceptsKey: (key) => key === 'model' || key === 'effort',
    fallbackModels: () => null,
    effortDefaultsToModel: false,
    presentPicker: ({ models, current }) => {
      const grouped = groupAntigravityModelVariants(models)
      return {
        models: grouped,
        current: {
          ...current,
          ...antigravitySelectionForPicker(current.model, current.effort, grouped)
        }
      }
    }
  }
}
