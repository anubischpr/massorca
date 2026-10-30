import { useLocalSearchParams, useRouter } from 'expo-router'
import { firstParam } from '../../../../src/navigation/route-param-reader'
import { MobilePrototypeDesignSystemScreen } from '../../../../src/prototypes/MobilePrototypeDesignSystemScreen'

/** One project's design system: tokens, components and source, with the draft that changes them. */
export default function MobilePrototypeSystemRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    project?: string | string[]
  }>()
  return (
    <MobilePrototypeDesignSystemScreen
      hostId={firstParam(params.hostId) ?? ''}
      projectKey={firstParam(params.project) ?? ''}
      onBack={() => router.back()}
    />
  )
}
