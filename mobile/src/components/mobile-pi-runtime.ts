import { formatAgentRowTypeLabel, type PiRowRuntime } from '../../../src/shared/agent-type-label'
import { piRuntimeForSessionFilePath } from '../../../src/shared/pi-runtime-selection'

// Why: the host sends `piRuntime` only for Gentle Shell; stock Pi and older hosts omit it and keep the Pi identity.
/** A host row or chat tab that may carry the Gentle Shell marker; unknown values read as stock Pi. */
export type MobilePiRuntimeMarker = { readonly piRuntime?: unknown }

export function mobilePiRuntimeFromMarker(marker: MobilePiRuntimeMarker): PiRowRuntime {
  return marker.piRuntime === 'gentle-shell' ? 'gentle-shell' : 'pi'
}

export function mobilePiRuntimeFromTranscriptPath(
  transcriptPath: string | null | undefined
): PiRowRuntime {
  return piRuntimeForSessionFilePath(transcriptPath)
}

export function mobilePiAgentLabel(runtime: PiRowRuntime): string {
  return formatAgentRowTypeLabel({ agentType: 'pi' }, runtime)
}
