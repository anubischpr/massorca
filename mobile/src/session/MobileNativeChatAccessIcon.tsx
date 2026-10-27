import { Eye, Lock, LockKeyhole, LockOpen, NotebookPen, type LucideIcon } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import type {
  MobileAccessDisplay,
  MobileAccessIconName,
  MobileAccessTone
} from './mobile-native-chat-access-mode-display'

const ICONS: Record<MobileAccessIconName, LucideIcon> = {
  Lock,
  LockKeyhole,
  NotebookPen,
  Eye,
  LockOpen
}

const TONE_COLORS: Record<MobileAccessTone, string> = {
  neutral: colors.textSecondary,
  caution: colors.statusAmber,
  danger: colors.statusRed
}

/** An access mode's glyph in its risk tone; the toolbar button and the sheet rows both draw it. */
export function MobileNativeChatAccessIcon({
  display,
  size
}: {
  display: MobileAccessDisplay
  size: number
}): React.JSX.Element {
  const Icon = ICONS[display.icon]
  return <Icon size={size} color={TONE_COLORS[display.tone]} strokeWidth={2} />
}
