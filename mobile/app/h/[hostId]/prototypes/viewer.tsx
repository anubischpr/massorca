import { useLocalSearchParams, useRouter } from 'expo-router'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { MobilePrototypeUnopenable } from '../../../../src/prototypes/MobilePrototypeUnopenable'
import { MobilePrototypeViewerScreen } from '../../../../src/prototypes/MobilePrototypeViewerScreen'

/** One prototype, to browse or annotate; a link that names no host or prototype says it cannot open. */
export default function MobilePrototypeViewerRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    request?: string | string[]
  }>()
  const hostId = firstParam(params.hostId) ?? ''
  const requestId = firstParam(params.request) ?? ''
  const onBack = () => router.back()
  if (hostId === '' || requestId === '') {
    return <MobilePrototypeUnopenable onBack={onBack} />
  }
  return <MobilePrototypeViewerScreen hostId={hostId} requestId={requestId} onBack={onBack} />
}
