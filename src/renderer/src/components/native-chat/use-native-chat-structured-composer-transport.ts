import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { dispatchStructuredAgentSessionComposerCommand } from '../../../../shared/structured-agent-session-composer'
import { useStructuredAgentAcceptsImages } from '@/runtime/use-host-structured-agent'
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

/** What the composer of a structured chat sends, picks and runs through, from the chat's controller. */
export function useNativeChatStructuredComposerTransport(args: {
  props: Pick<NativeChatStructuredViewProps, 'agent' | 'sessionId' | 'target'>
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
  optionPickerRequest: NativeChatOptionPickerRequest | null
  setOptionPickerRequest: Dispatch<SetStateAction<NativeChatOptionPickerRequest | null>>
  onError: NativeChatStructuredComposerTransport['onError']
  onSubmitted: () => void
  queuedMessages: Pick<StructuredAgentSessionQueuedMessagesController, 'queueHold' | 'queueResume'>
}): NativeChatStructuredComposerTransport {
  const { props, controller, sendThroughLaunch, starting, worktreeId, optionPickerRequest } = args
  const { setOptionPickerRequest, onError, onSubmitted, queuedMessages } = args
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
          invokeAction: async (id) => {
            setOptionPickerRequest((current) => ({ id, sequence: (current?.sequence ?? 0) + 1 }))
            return true
          },
          setOption: controller.setStructuredOption,
          conversationCommands: controller.conversationCommands,
          runConversationCommand: controller.runConversationCommand,
          providerCommands: controller.providerCommands.available,
          runProviderCommand,
          revealBackgroundTasks,
          openSourceControl: openNativeChatSourceControl,
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
    onError,
    onSubmitted,
    optionPickerRequest,
    props.agent,
    props.sessionId,
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
