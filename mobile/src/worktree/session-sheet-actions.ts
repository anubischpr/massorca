import { Copy } from 'lucide-react-native'
import type { ActionSheetAction } from '../components/ActionSheetModal'

/**
 * The long-press sheet for one session row. Rename and Close are not offered: the session row
 * carries no terminal handle, which the existing terminal.rename and terminal.close take.
 */
export function buildSessionSheetActions(args: { onCopyPath: () => void }): ActionSheetAction[] {
  return [{ label: 'Copy Path', icon: Copy, onPress: args.onCopyPath }]
}
