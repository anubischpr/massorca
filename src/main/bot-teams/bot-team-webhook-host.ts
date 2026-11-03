import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { startTaskOnHost } from '../runtime/rpc/methods/bot-team-room'
import { createBotTeamWebhookReceiver } from './bot-team-webhook-call'
import { setBotTeamWebhookBaseUrl } from './bot-team-webhook-endpoint'
import { listenForBotTeamWebhooks } from './bot-team-webhook-listener'

let started = false

/** On by default so a person who only installs the app can use a web address with no setup. */
export function startBotTeamWebhookListener(runtime: OrcaRuntimeService): void {
  if (started) {
    return
  }
  started = true
  const receive = createBotTeamWebhookReceiver({
    getDb: () => runtime.getOrchestrationDb(),
    startTask: (taskId) => startTaskOnHost({ runtime }, taskId)
  })
  void listenForBotTeamWebhooks({ receive }).then(
    (listener) => setBotTeamWebhookBaseUrl(listener.baseUrl),
    () => {
      // Every fixed port is taken: the page keeps saying this host does not take calls.
      console.warn('[bot-teams] no port was free for web addresses')
    }
  )
}
