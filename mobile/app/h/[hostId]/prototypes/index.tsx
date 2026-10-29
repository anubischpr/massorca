import { useLocalSearchParams, useRouter } from 'expo-router'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { MobilePrototypeListScreen } from '../../../../src/prototypes/MobilePrototypeListScreen'

/** Every agent's prototypes: the list. A one-direction set opens straight in the viewer. */
export default function MobilePrototypesRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    session?: string | string[]
  }>()
  const hostId = firstParam(params.hostId) ?? ''
  return (
    <MobilePrototypeListScreen
      hostId={hostId}
      sessionId={firstParam(params.session) ?? null}
      onBack={() => router.back()}
      onOpenSet={(row) => {
        router.push({
          // A one-direction set opens straight in the viewer.
          pathname:
            row.set.directions.length <= 1
              ? '/h/[hostId]/prototypes/viewer'
              : '/h/[hostId]/prototypes/set',
          params: { hostId, request: row.set.requestId }
        })
      }}
    />
  )
}
