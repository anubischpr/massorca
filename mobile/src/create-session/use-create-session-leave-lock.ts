import { useEffect } from 'react'
import { useNavigation } from 'expo-router'
import { useBackClaim } from '../navigation/use-back-claim'

/**
 * Keeps the user on the screen while the host builds the session. Leaving would drop the result of
 * a create that cannot be cancelled, and a second attempt would build the worktree again.
 */
export function useCreateSessionLeaveLock(locked: boolean): void {
  useBackClaim(locked ? () => true : null)
  const navigation = useNavigation()
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !locked })
  }, [locked, navigation])
}
