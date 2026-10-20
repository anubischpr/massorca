import { translate } from '@/i18n/i18n'
import { resolvePiRuntime, type PiRuntimeSelection } from '../../../shared/pi-runtime-selection'

/** A Pi runtime for display, or `unknown` before settings have loaded, so labels never flash between names. */
export type PiDisplayRuntime = PiRuntimeSelection | 'unknown'

/** The runtime a Pi command setting names; stock `pi` when no Gentle Shell command is set. */
export function piRuntimeFromCommand(command: string | undefined): PiRuntimeSelection {
  return resolvePiRuntime({ command })
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
