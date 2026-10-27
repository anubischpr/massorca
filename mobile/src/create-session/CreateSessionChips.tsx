import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Folder, GitBranch } from 'lucide-react-native'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { colors, spacing, typography } from '../theme/mobile-theme'

const CHIP_HEIGHT = 38

function Chip({
  accessibleName,
  disabled,
  onPress,
  children
}: {
  accessibleName: string
  disabled?: boolean
  onPress: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibleName}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  )
}

/** Project, workspace mode and agent: what the session will run on, one tap each. */
export function CreateSessionChips({
  projectLabel,
  workspaceLabel,
  workspaceDisabled,
  agent,
  agentLabel,
  disabled,
  onOpenProject,
  onOpenWorkspace,
  onOpenAgent
}: {
  projectLabel: string
  workspaceLabel: string
  /** A folder has no Git, so its chip reads "No Git" and does not open. */
  workspaceDisabled: boolean
  agent: TuiAgent | null
  agentLabel: string
  disabled: boolean
  onOpenProject: () => void
  onOpenWorkspace: () => void
  onOpenAgent: () => void
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      <Chip accessibleName={`Project, ${projectLabel}`} disabled={disabled} onPress={onOpenProject}>
        <Folder size={16} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.label} numberOfLines={1}>
          {projectLabel}
        </Text>
      </Chip>
      <Chip
        accessibleName={`Workspace, ${workspaceLabel}`}
        disabled={disabled || workspaceDisabled}
        onPress={onOpenWorkspace}
      >
        <GitBranch size={16} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.label}>{workspaceLabel}</Text>
      </Chip>
      <Chip
        accessibleName={`Agent, ${agentLabel}`}
        disabled={disabled || agent === null}
        onPress={onOpenAgent}
      >
        {agent ? <MobileAgentIcon agentId={agent} size={16} /> : <View style={styles.noAgentDot} />}
        <Text style={styles.label}>{agentLabel}</Text>
      </Chip>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: 2 },
  chip: {
    height: CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: CHIP_HEIGHT / 2,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  label: { maxWidth: 180, color: colors.textPrimary, fontSize: typography.metaSize },
  noAgentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 }
})
