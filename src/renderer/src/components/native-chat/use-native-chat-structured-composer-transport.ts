import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { dispatchStructuredAgentSessionComposerCommand } from '../../../../shared/structured-agent-session-composer'
import { useStructuredAgentAcceptsImages } from '@/runtime/use-host-structured-agent'
import { translate } from '@/i18n/i18n'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import { reportReplySuggestionDismissed } from './native-chat-reply-suggestion-dismissal'
import type {
  NativeChatOptionPickerRequest,
  NativeChatStructuredComposerTransport
} from './native-chat-composer-types'
import type { NativeChatStructuredViewProps } from './native-chat-view-types'
import type { useStructuredAgentSession } from './use-structured-agent-session'
import { getHostClaimedNativeChatCommands } from '../../../../shared/native-chat-agent-profiles'
import { requestNativeChatBackgroundTasksReveal } from './native-chat-background-tasks-reveal'
import { openNativeChatSourceControl } from './native-chat-session-navigation'
import { useNativeChatProviderCommandRunner } from './use-native-chat-provider-command-runner'
import { useNativeChatReplySuggestion } from './use-native-chat-reply-suggestion'
import type { StructuredAgentSessionQueuedMessagesController } from './use-structured-agent-session-queued-messages'
import { requestNativeChatOpenSurface } from './native-chat-open-surface'
import {
  appendNativeChatCommandResultRow,
  nativeChatStatusRowText
} from './native-chat-command-result-rows'
import { nativeChatClientCommandSurface } from './native-chat-client-commands'
import {
  nativeChatLatestAnswerMarkdown,
  nativeChatTranscriptMarkdown
} from './native-chat-transcript-markdown'
import { nativeChatStatusFacts } from './native-chat-status-facts'
import { requestTerminalTabRename } from '../tab-bar/terminal-tab-rename-request'

async function copyNativeChatText(text: string): Promise<boolean> {
  try {
    await window.api.ui.writeClipboardText(text)
    return true
  } catch {
    return false
  }
}

/** `/rename <name>`: the chat's tab takes the name as its label. */
async function renameNativeChatTab(tabId: string, name: string): Promise<void> {
  const { useAppStore } = await import('@/store')
  useAppStore.getState().setTabCustomLabel(tabId, name)
}

/** What the composer of a structured chat sends, picks and runs through, from the chat's controller. */
export function useNativeChatStructuredComposerTransport(args: {
  props: Pick<NativeChatStructuredViewProps, 'agent' | 'sessionId' | 'target' | 'tabId'>
  controller: ReturnType<typeof useStructuredAgentSession>
  /** Sends now, restarts a failed start with the message, or refuses while the chat starts. */
  sendThroughLaunch: (
    text: string,
    withImages: boolean,
    send: () => boolean | 'queued'
  ) => boolean | 'queued'
  /** The chat is starting: it takes no send yet. */
  starting: boolean
  worktreeId: string | undefined
  /** The folder the chat works in, as `/status` reports it. */
  workspacePath: string | null
  optionPickerRequest: NativeChatOptionPickerRequest | null
  setOptionPickerRequest: Dispatch<SetStateAction<NativeChatOptionPickerRequest | null>>
  onError: NativeChatStructuredComposerTransport['onError']
  onSubmitted: () => void
  queuedMessages: Pick<StructuredAgentSessionQueuedMessagesController, 'queueHold' | 'queueResume'>
}): NativeChatStructuredComposerTransport {
  const { props, controller, sendThroughLaunch, starting, worktreeId, optionPickerRequest } = args
  const { setOptionPickerRequest, onError, onSubmitted, queuedMessages, workspacePath } = args
  const claimsPs = getHostClaimedNativeChatCommands(props.agent).some(
    (entry) => entry.name === 'ps'
  )
  const backgroundTasksShown = controller.backgroundTasks.show
  const sessionId = props.sessionId
  // `/ps` and `/tasks` open the chat's background-tasks strip for every agent; the menu lists `/ps`
  // only where the agent claims its own `ps`.
  const revealBackgroundTasks = useMemo(
    () => () => {
      if (backgroundTasksShown) {
        requestNativeChatBackgroundTasksReveal(sessionId)
      }
      return backgroundTasksShown
    },
    [backgroundTasksShown, sessionId]
  )
  const runProviderCommand = useNativeChatProviderCommandRunner({
    agent: props.agent,
    worktreeId,
    commands: controller.providerCommands
  })
  const acceptsImages = useStructuredAgentAcceptsImages(props.target, props.agent)
  const replySuggestion = useNativeChatReplySuggestion({
    sessionId: props.sessionId,
    suggestion: controller.promptSuggestion,
    idle: !controller.isWorking && !controller.queueSendsNext && !starting,
    onDismissed: (suggestion) =>
      reportReplySuggestionDismissed(props.target, props.sessionId, suggestion)
  })
  return useMemo((): NativeChatStructuredComposerTransport => {
    const threadGoal = controller.threadGoal
    const setThreadGoalObjective = threadGoal
      ? (objective: string) => threadGoal.change({ kind: 'set', objective })
      : null
    // Opens the option picker a `/model`, `/effort` or `/permissions` names, the way its pill does.
    const openOptionPicker = async (id: string): Promise<boolean> => {
      setOptionPickerRequest((current) => ({ id, sequence: (current?.sequence ?? 0) + 1 }))
      return true
    }
    const clientCommands = nativeChatClientCommandSurface(props.agent, {
      status: () => {
        const facts = nativeChatStatusFacts({
          agent: props.agent,
          sessionId: props.sessionId,
          workspacePath,
          snapshot: controller.optionSnapshot,
          context: controller.contextSummary
        })
        appendNativeChatCommandResultRow(props.sessionId, nativeChatStatusRowText(facts))
        return true
      },
      context: () => {
        requestNativeChatOpenSurface(props.sessionId, 'context')
        return true
      },
      permissions: async () =>
        controller.optionSnapshot.some((entry) => entry.id === 'accessMode') &&
        (await openOptionPicker('accessMode')),
      copy: async () => {
        const markdown = nativeChatLatestAnswerMarkdown(controller.journalItems)
        if (markdown === '' || !(await copyNativeChatText(markdown))) {
          return false
        }
        toast.success(translate('components.native-chat.commands.copied', 'Copied'))
        return true
      },
      export: async () => {
        const markdown = nativeChatTranscriptMarkdown(controller.journalItems, {
          you: translate('components.native-chat.commands.exportYou', 'You'),
          agent: structuredAgentLabel(props.agent)
        })
        if (markdown === '' || !(await copyNativeChatText(markdown))) {
          return false
        }
        toast.success(
          translate(
            'components.native-chat.commands.exportCopied',
            'Copied the chat as Markdown. Orca cannot save Markdown files yet.'
          )
        )
        return true
      },
      mention: (query) => {
        requestNativeChatOpenSurface(props.sessionId, 'mention', query)
        return true
      },
      rename: (name) => {
        if (name === null) {
          requestTerminalTabRename(props.tabId)
          return true
        }
        void renameNativeChatTab(props.tabId, name)
        return true
      }
    })
    return {
      send: (text, attachments) =>
        sendThroughLaunch(text, attachments.length > 0, () =>
          controller.send(
            text,
            attachments.map(({ path, connectionId }) => ({
              path,
              previewUri: path,
              ...(connectionId ? { connectionId } : {})
            }))
          )
        ),
      dispatchCommand: (text: string) =>
        dispatchStructuredAgentSessionComposerCommand(text, {
          agent: props.agent,
          functions: controller.sessionFunctions,
          skills: controller.sessionCommands
            ?.filter((entry) => entry.kind === 'skill')
            .map((entry) => entry.name),
          snapshot: controller.optionSnapshot,
          invokeAction: openOptionPicker,
          setOption: controller.setStructuredOption,
          conversationCommands: controller.conversationCommands,
          runConversationCommand: controller.runConversationCommand,
          providerCommands: controller.providerCommands.available,
          runProviderCommand,
          revealBackgroundTasks,
          openSourceControl: openNativeChatSourceControl,
          ...clientCommands,
          ...(setThreadGoalObjective ? { setThreadGoalObjective } : {})
        }),
      ...(setThreadGoalObjective ? { threadGoal: { setObjective: setThreadGoalObjective } } : {}),
      sendOut: controller.sendOut || starting,
      optionsSurface: controller.optionSurface,
      conversationCommands: controller.conversationCommands,
      providerCommands: controller.providerCommands.available,
      ...(claimsPs ? { backgroundTasksReveal: true } : {}),
      optionSnapshot: controller.optionSnapshot,
      optionPickerRequest,
      sessionCommands: controller.sessionCommands,
      sessionFunctions: controller.sessionFunctions,
      acceptsImages,
      contextUsage: controller.contextUsage,
      worktreeId,
      onError,
      onSubmitted,
      runtime: props.target.kind === 'local' ? 'local' : 'remote',
      sessionId: props.sessionId,
      runtimeEnvironmentId:
        props.target.kind === 'local' ? null : (props.target.environmentId ?? null),
      replySuggestion,
      queueHold: queuedMessages.queueHold,
      queueResume: queuedMessages.queueResume
    }
  }, [
    acceptsImages,
    controller,
    worktreeId,
    workspacePath,
    onError,
    onSubmitted,
    optionPickerRequest,
    props.agent,
    props.sessionId,
    props.tabId,
    props.target,
    queuedMessages,
    claimsPs,
    replySuggestion,
    revealBackgroundTasks,
    runProviderCommand,
    sendThroughLaunch,
    setOptionPickerRequest,
    starting
  ])
}
