import { useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NewWorkspaceSshConnectionField } from '../components/NewWorkspaceSshConnectionField'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { CreateSessionChips } from './CreateSessionChips'
import { CreateSessionComposerRow } from './CreateSessionComposerRow'
import type { CreateSessionMoreAction } from './CreateSessionMoreSheet'
import { CreateSessionProgress } from './CreateSessionProgress'
import { CreateSessionSheets, type CreateSessionSheet } from './CreateSessionSheets'
import { CreateSessionTopBar } from './CreateSessionTopBar'
import { createSessionProgressSteps } from './create-session-launch-plan'
import { isFolderRepo } from './create-session-model'
import {
  createSessionAgentLabel,
  useCreateSessionController
} from './use-create-session-controller'
import type { CreateSessionLanding } from './use-create-session-submit'

/** "What do you want to build?": the first message owns the screen; the setup floats below it. */
export function CreateSessionScreen({
  client,
  hostId,
  onClose,
  onLanded,
  onOpenAdvancedForm
}: {
  client: RpcClient | null
  hostId: string
  onClose: () => void
  onLanded: (landing: CreateSessionLanding) => void
  onOpenAdvancedForm: () => void
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const controller = useCreateSessionController({ client, hostId, onLanded })
  const [sheet, setSheet] = useState<CreateSessionSheet>(null)
  const { selection, repo, phase } = controller
  const busy = phase.kind === 'creating' || controller.blankBusy
  const agent = selection?.agent ?? null

  function openSheet(next: Exclude<CreateSessionSheet, null>): void {
    Keyboard.dismiss()
    setSheet(next)
  }
  function pickMore(action: CreateSessionMoreAction): void {
    if (action === 'advanced') {
      onOpenAdvancedForm()
    } else {
      controller.startBlankTerminal()
    }
  }

  if (phase.kind === 'creating') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
        <CreateSessionProgress
          prompt={phase.plan.prompt}
          steps={createSessionProgressSteps(phase.plan, createSessionAgentLabel(phase.plan.agent))}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + spacing.sm }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CreateSessionTopBar
        hostLabel={controller.hostLabel}
        disabled={busy || controller.hostOptions.length === 0}
        onClose={onClose}
        onOpenHost={() => openSheet('host')}
        onOpenMore={() => openSheet('more')}
      />
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {'What do you want\nto build?'}
        </Text>
        <TextInput
          style={styles.input}
          value={controller.draft}
          onChangeText={controller.setDraft}
          placeholder="Describe the task to start the session…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Task"
          multiline
          autoFocus
          textAlignVertical="top"
          editable={!busy}
        />
      </View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {!controller.loading && controller.repos.length === 0 ? (
          <Text style={styles.notice}>
            No projects on this computer yet. Add one from the desktop app to start a session.
          </Text>
        ) : null}
        {repo && controller.sshGate.requiresConnection ? (
          <NewWorkspaceSshConnectionField
            repoName={repo.displayName}
            sshGate={controller.sshGate}
            onConnect={() => void controller.connectSsh()}
          />
        ) : null}
        {controller.error ? (
          <Text style={styles.error} accessibilityRole="alert" onPress={controller.clearError}>
            {controller.error}
          </Text>
        ) : null}
        <CreateSessionChips
          projectLabel={repo?.displayName ?? 'No project'}
          workspaceLabel={controller.workspaceLabel || 'Workspace'}
          workspaceDisabled={isFolderRepo(repo)}
          agent={agent}
          agentLabel={createSessionAgentLabel(agent)}
          disabled={busy || selection === null}
          onOpenProject={() => openSheet('project')}
          onOpenWorkspace={() => openSheet('mode')}
          onOpenAgent={() => openSheet('agent')}
        />
        <CreateSessionComposerRow
          agent={agent}
          options={controller.options}
          canSubmit={controller.canSubmit}
          onSubmit={controller.submit}
        />
        <Text style={styles.footnote}>{controller.footnote}</Text>
      </View>
      <CreateSessionSheets
        controller={controller}
        sheet={sheet}
        onSheetChange={setSheet}
        onMore={pickMore}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 22, paddingTop: 40 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '600', lineHeight: 31 },
  input: {
    flex: 1,
    marginTop: spacing.lg,
    padding: 0,
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 25
  },
  bottom: { gap: 10, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  notice: { color: colors.textSecondary, fontSize: typography.bodySize, textAlign: 'center' },
  error: { color: colors.statusRed, fontSize: typography.bodySize, textAlign: 'center' },
  footnote: { color: colors.textMuted, fontSize: typography.metaSize, textAlign: 'center' }
})
