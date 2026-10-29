import { useLocalSearchParams } from 'expo-router'
import { firstParam } from '../../../src/navigation/route-param-reader'
import { MobilePrototypeSettingsScreen } from '../../../src/prototypes/MobilePrototypeSettingsScreen'

/** Settings › Prototypes, reached from the "How many prototypes?" card. */
export default function MobilePrototypeSettingsRoute() {
  const params = useLocalSearchParams<{ hostId?: string | string[] }>()
  return <MobilePrototypeSettingsScreen hostId={firstParam(params.hostId) ?? ''} />
}
