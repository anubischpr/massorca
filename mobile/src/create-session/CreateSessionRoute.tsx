import { useLocalSearchParams, useRouter } from 'expo-router'
import { hostNewWorktreeRoute, hostNewWorktreeSessionRoute } from '../host-route-action-state'
import { firstParam } from '../navigation/route-param-reader'
import { useHostClient } from '../transport/client-context'
import { CreateSessionScreen } from './CreateSessionScreen'

/** The new-session route: wires the screen to the host connection and to navigation. */
export function CreateSessionRoute(): React.JSX.Element {
  const params = useLocalSearchParams<{ hostId?: string | string[] }>()
  const hostId = firstParam(params.hostId)
  const router = useRouter()
  const { client } = useHostClient(hostId)
  return (
    <CreateSessionScreen
      client={client}
      hostId={hostId}
      onClose={() => {
        // Why: a deep link can open this route first, so there may be nothing to go back to.
        if (router.canGoBack()) {
          router.back()
        } else {
          router.replace(`/h/${encodeURIComponent(hostId)}`)
        }
      }}
      onLanded={(landing) => {
        // Replaced, not pushed, so back from the chat returns to the list instead of the form.
        router.replace(
          hostNewWorktreeSessionRoute(
            hostId,
            landing.worktreeId,
            landing.name,
            landing.warning,
            landing.paneKey
          )
        )
      }}
      // Why: dismissTo reuses the host list already on the stack, where the existing form opens.
      onOpenAdvancedForm={() => router.dismissTo(hostNewWorktreeRoute(hostId))}
    />
  )
}
