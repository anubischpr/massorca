import { translate } from '@/i18n/i18n'
import {
  resolvePiRuntime,
  piRuntimeFromSessionEvidence,
  type PiRuntimeEvidence,
  type PiRuntimeSelection
} from '../../../shared/pi-runtime-selection'

/** A Pi runtime for display, or `unknown` while no evidence names one, so labels never flash between names. */
export type PiDisplayRuntime = PiRuntimeSelection | 'unknown'

/**
 * The Pi runtime a label names, from the same evidence the launch resolver reads. Reuses resolvePiRuntime
 * once any evidence names a runtime; a bare stock default is not evidence, so it stays `unknown`.
 */
export function resolvePiDisplayRuntime(evidence: PiRuntimeEvidence): PiDisplayRuntime {
  const sessionNamed = piRuntimeFromSessionEvidence(evidence) !== undefined
  const commandNamed = Boolean(evidence.command?.trim())
  const hostNamed = evidence.hostAnswer === 'pi' || evidence.hostAnswer === 'gentle-shell'
  if (!sessionNamed && !commandNamed && !hostNamed) {
    return 'unknown'
  }
  return resolvePiRuntime(evidence)
}

export function piRuntimeLabel(runtime: PiDisplayRuntime): string {
  if (runtime === 'gentle-shell') {
    return translate('settings.agents.gentleShell', 'Gentle Shell')
  }
  if (runtime === 'pi') {
    return translate('settings.agents.stockPi', 'Pi')
  }
  return translate('settings.agents.piAndGentleShell', 'Pi / Gentle Shell')
}

/** The `data-agent-brand` value for a row, set only on the Gentle Shell Pi entry so the brand row styling reaches it. */
export function agentBrandRowAttribute(
  agent: string,
  piRuntime: PiDisplayRuntime
): 'gentle-shell' | undefined {
  return agent === 'pi' && piRuntime === 'gentle-shell' ? 'gentle-shell' : undefined
}
