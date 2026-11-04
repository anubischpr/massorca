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
    version?: string | string[]
  }>()
  const hostId = firstParam(params.hostId) ?? ''
  const requestId = firstParam(params.request) ?? ''
  // Why: an earlier version is opened by its number; a value that is not a whole number opens the current one.
  const versionParam = Number(firstParam(params.version) ?? '')
  const earlierVersion = Number.isInteger(versionParam) && versionParam >= 1 ? versionParam : null
  const onBack = () => router.back()
  if (hostId === '' || requestId === '') {
    return <MobilePrototypeUnopenable onBack={onBack} />
  }
  return (
    <MobilePrototypeViewerScreen
      hostId={hostId}
      requestId={requestId}
      earlierVersion={earlierVersion}
      onBack={onBack}
    />
  )
}
