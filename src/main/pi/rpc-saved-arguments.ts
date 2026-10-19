import { structuredPassthroughLaunchArgs } from '../native-chat/structured-agent-passthrough-launch-args'

/** Session, transport and mode options Pi's structured launch sets itself. */
const PI_OWNED_ARGUMENTS = {
  valueFlags: new Set(['--mode', '--session', '--fork']),
  switches: new Set([
    '--print',
    '-p',
    '--no-session',
    '--resume',
    '-r',
    '--continue',
    '-c',
    '--help',
    '-h',
    '--version',
    '-v'
  ])
}

/** The user's saved Pi/Gentle Shell Arguments minus what the structured launch owns. */
export function piStructuredLaunchArgs(tokens: readonly string[]): string[] {
  return structuredPassthroughLaunchArgs('Pi', tokens, PI_OWNED_ARGUMENTS)
}
