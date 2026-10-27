import { ListChecks, ListTodo } from 'lucide-react-native'
import { MobileAgentSessionHistoryIcon } from '../agent-history/MobileAgentSessionHistoryIcon'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { colors } from '../theme/mobile-theme'

type Props = {
  visible: boolean
  showPlan: boolean
  /** "2 of 5 done" for the plan row's hint; absent when the chat has no plan. */
  planHint?: string
  showAgentSessionHistory: boolean
  showChecks: boolean
  onOpenPlan: () => void
  onOpenAgentSessionHistory: () => void
  onOpenChecks: () => void
  onClose: () => void
}

export function MobileSessionHeaderMoreActionsSheet({
  visible,
  showPlan,
  planHint,
  showAgentSessionHistory,
  showChecks,
  onOpenPlan,
  onOpenAgentSessionHistory,
  onOpenChecks,
  onClose
}: Props) {
  return (
    <ActionSheetModal
      visible={visible}
      actions={[
        ...(showPlan
          ? [
              {
                label: 'Plan',
                hint: planHint,
                icon: ListTodo,
                // Why: the plan sheet opens over this one's native modal only after it unmounts.
                closeBeforePress: true,
                onPress: onOpenPlan
              }
            ]
          : []),
        ...(showAgentSessionHistory
          ? [
              {
                label: 'Agent History',
                hint: 'Browse and resume agent sessions',
                renderIcon: () => (
                  <MobileAgentSessionHistoryIcon
                    size={16}
                    color={colors.textSecondary}
                    strokeWidth={2.1}
                  />
                ),
                onPress: onOpenAgentSessionHistory
              }
            ]
          : []),
        ...(showChecks
          ? [
              {
                label: 'Checks',
                hint: 'Open pull request checks',
                icon: ListChecks,
                onPress: onOpenChecks
              }
            ]
          : [])
      ]}
      onClose={onClose}
    />
  )
}
