import { formatAgentRowTypeLabel, type PiRowRuntime } from '../../../src/shared/agent-type-label'
import { piRuntimeForSessionFilePath } from '../../../src/shared/pi-runtime-selection'

// Why: the host sends `piRuntime` only for Gentle Shell; stock Pi and older hosts omit it and keep the Pi identity.
export function mobilePiRuntimeFromMarker(wireRow: object): PiRowRuntime {
  return 'piRuntime' in wireRow && wireRow.piRuntime === 'gentle-shell' ? 'gentle-shell' : 'pi'
}

export function mobilePiRuntimeFromTranscriptPath(
  transcriptPath: string | null | undefined
): PiRowRuntime {
  return piRuntimeForSessionFilePath(transcriptPath)
}

export function mobilePiAgentLabel(runtime: PiRowRuntime): string {
  return formatAgentRowTypeLabel({ agentType: 'pi' }, runtime)
}
