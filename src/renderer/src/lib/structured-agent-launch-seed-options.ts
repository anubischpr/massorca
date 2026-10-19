import type { TuiAgent } from '../../../shared/tui-agent'
import { isPiRuntimeSelection } from '../../../shared/pi-runtime-selection'
import { resolveStructuredLaunchSeedOptions } from '../../../shared/native-chat-session-option-defaults'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'

export type LaunchSeed = Readonly<Record<string, string>> | undefined

/** What create will seed: this machine's saved selection for its own chats; for a paired server's,
 *  the server's own, which it reports when it admits the chat (absent from an older server). */
export function launchSeedOptions(
  nativeChatSessionOptions: GlobalSettings['nativeChatSessionOptions'] | undefined,
  owner: { target: RuntimeClientTarget },
  agent: TuiAgent,
  hostSeedOptions: LaunchSeed
): { seedOptions?: Readonly<Record<string, string>> } {
  // Why: this machine's saved selection has no runtime, but its host may have resolved Gentle Shell.
  const hostPiRuntime =
    agent === 'pi' && isPiRuntimeSelection(hostSeedOptions?.piRuntime)
      ? hostSeedOptions.piRuntime
      : undefined
  const localSeed = resolveStructuredLaunchSeedOptions(nativeChatSessionOptions, agent)
  const seedOptions =
    owner.target.kind === 'local'
      ? hostPiRuntime
        ? { ...localSeed, piRuntime: hostPiRuntime }
        : localSeed
      : hostSeedOptions
  return seedOptions ? { seedOptions } : {}
}
