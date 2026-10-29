// The host's `prototypeCount` setting, read and written like the other host settings the phone edits.
import {
  DEFAULT_PROTOTYPE_COUNT_SETTING,
  sanitizePrototypeCountSetting,
  type PrototypeCountSetting
} from '../../../src/shared/prototype-count-setting'
import { taskSettingsWrite } from '../tasks/mobile-task-runtime-operations'
import type { RpcClient } from '../transport/rpc-client'
import { settingsRead } from '../transport/settings-read-operations'

type HostClient = Pick<RpcClient, 'sendRequest'>

function prototypeCountOf(settings: unknown): unknown {
  return typeof settings === 'object' && settings !== null && 'prototypeCount' in settings
    ? settings.prototypeCount
    : undefined
}

/** The setting the host holds; a host that does not answer, or has none, reads as the default. */
export async function readMobilePrototypeCountSetting(
  client: HostClient
): Promise<PrototypeCountSetting> {
  try {
    const settings = settingsRead.interpret(await settingsRead.request(client))
    return settings.accepted
      ? sanitizePrototypeCountSetting(prototypeCountOf(settings.value))
      : { ...DEFAULT_PROTOTYPE_COUNT_SETTING }
  } catch {
    return { ...DEFAULT_PROTOTYPE_COUNT_SETTING }
  }
}

/** Best-effort, like every host setting the phone writes: the screen already shows the new value. */
export async function writeMobilePrototypeCountSetting(
  client: HostClient,
  setting: PrototypeCountSetting
): Promise<void> {
  await taskSettingsWrite
    .request(client, { prototypeCount: sanitizePrototypeCountSetting(setting) })
    .catch(() => undefined)
}
