import { useLocalSearchParams, useRouter } from 'expo-router'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { MobilePrototypeViewerScreen } from '../../../../src/prototypes/MobilePrototypeViewerScreen'

/** One prototype, to browse or annotate. */
export default function MobilePrototypeViewerRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    request?: string | string[]
  }>()
  return (
    <MobilePrototypeViewerScreen
      hostId={firstParam(params.hostId) ?? ''}
      requestId={firstParam(params.request) ?? ''}
      onBack={() => router.back()}
    />
  )
}
