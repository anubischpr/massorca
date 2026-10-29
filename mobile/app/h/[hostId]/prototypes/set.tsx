import { useLocalSearchParams, useRouter } from 'expo-router'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { MobilePrototypeSetScreen } from '../../../../src/prototypes/MobilePrototypeSetScreen'

/** One request's directions, swiped side by side. */
export default function MobilePrototypeSetRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    request?: string | string[]
  }>()
  const hostId = firstParam(params.hostId) ?? ''
  const requestId = firstParam(params.request) ?? ''
  return (
    <MobilePrototypeSetScreen
      hostId={hostId}
      requestId={requestId}
      onBack={() => router.back()}
      onOpenDirection={() =>
        router.push({
          pathname: '/h/[hostId]/prototypes/viewer',
          params: { hostId, request: requestId }
        })
      }
    />
  )
}
