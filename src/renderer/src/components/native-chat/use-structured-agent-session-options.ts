import { useCallback, useMemo } from 'react'
import type {
  AgentSessionOptionResult,
  AgentSessionOptionsResult
} from '../../../../shared/agent-session-wire'
import type { AgentType } from '../../../../shared/agent-status-types'
import { structuredAgentSessionSeedCatalog } from '../../../../shared/structured-agent-session-seed-catalog'
import type { SessionOptionsSurface } from '../../../../shared/native-chat-session-options'
import {
  applyStructuredAgentSessionOptions,
  canSetStructuredAgentSessionOption,
  commitStructuredAgentSessionOptionValues,
  lockedStructuredAgentSessionOptionSnapshot,
  structuredAgentSessionOptionSnapshot
} from '../../../../shared/structured-agent-session-options'
import { structuredAgentSessionOptionView } from '../../../../shared/structured-agent-session-option-view'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { encodeStructuredAgentSessionOptionValue } from '../../../../shared/structured-agent-session-option-codec'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'
import { useHostModelCatalogUpgrade } from './use-host-model-catalog-upgrade'
import { useStructuredProviderCommands } from './use-structured-agent-session-provider-commands'
import { useStructuredAgentSessionOptionState } from './use-structured-agent-session-option-state'
import { useStructuredAgentOptionPickMemory } from './use-structured-agent-option-pick-memory'
import {
  accessPickBlockedByProvider,
  lockAccessWhileProviderRuns,
  useStructuredAgentDeclaredAccess
} from './structured-agent-declared-access'
import type { StructuredAgentSessionLaunchView } from './use-native-chat-provisional-launch'
import { useRecordChatPiRuntime } from '@/lib/chat-pi-runtime-record'
import {
  getStructuredAgentSessionLaunchSelection,
  holdStructuredAgentSessionLaunchOption
} from '@/lib/structured-agent-session-launch-options'

const NO_HELD_OPTIONS: Readonly<Record<string, string>> = {}

export function useStructuredAgentSessionOptions(args: {
  agent: AgentType
  sessionId: string
  target: RuntimeClientTarget
  transportEnabled: boolean
  isVisible: boolean
  providerVisible: boolean
  providerStarting?: boolean
  providerRunning?: boolean
  fence: number | null
  turnId: string | null
  unloadedTurnRevisions: number | undefined
  mutate: StructuredAgentSessionMutate
  launch?: StructuredAgentSessionLaunchView
}) {
  const {
    agent,
    fence,
    launch,
    mutate,
    providerVisible,
    sessionId,
    target,
    transportEnabled,
    turnId
  } = args
  const launchSeedOptions = launch?.seedOptions
  const held = launch?.heldOptions ?? NO_HELD_OPTIONS
  const declaredAccess = useStructuredAgentDeclaredAccess({
    agent,
    target,
    launchSeedOptions,
    launching: launch !== undefined
  })
  const accessModes = declaredAccess?.modes
  const permissionPresets = declaredAccess?.presets
  // Published but not attached: the launch no longer holds picks and there is no fence to send one.
  const acceptsPicks = !transportEnabled || fence !== null
  const optionCatalog = useMemo(() => structuredAgentSessionSeedCatalog(agent), [agent])
  const identity = `${agent}:${sessionId}`
  const {
    optionState,
    optionStateRef,
    activeOptionRecordRef,
    pendingOptionRef,
    optionMutationGeneration,
    updateOptionState,
    conversationSupport,
    connectors
  } = useStructuredAgentSessionOptionState({
    agent,
    optionCatalog,
    identity,
    fence,
    sessionId,
    target,
    newLaunch: launch?.kind === 'new',
    ...(launch?.worktree ? { worktree: launch.worktree } : {}),
    seedsModel: launchSeedOptions?.model !== undefined,
    providerVisible,
    providerStarting: args.providerStarting ?? false,
    // A new chat's host knows nothing of its model before the provider starts; a resumed one's
    // holds the model it ran, so only the former waits rather than show the host's guess.
    readsBeforeStart: launch?.kind !== 'new',
    accessModes,
    permissionPresets,
    turnId,
    unloadedTurnRevisions: args.unloadedTurnRevisions
  })

  const hostCatalog = useHostModelCatalogUpgrade({
    agent,
    sessionId,
    target,
    optionCatalog,
    enabled: args.isVisible,
    // A resumed conversation may keep its own model, so only a new one runs the listed default.
    newLaunch: launch?.kind === 'new',
    ...(launch?.worktree ? { worktree: launch.worktree } : {}),
    fence,
    turnId,
    reportedUnpickedModel:
      launch?.kind === 'new' &&
      launchSeedOptions?.model === undefined &&
      optionState.catalogSource === 'live',
    ...(args.providerRunning ? { providerRunning: true } : {}),
    activeOptionRecordRef,
    updateOptionState
  })

  const { rememberOptionPicks, settleLaunchOptionPick } = useStructuredAgentOptionPickMemory({
    agent,
    target,
    optionStateRef,
    launchSeedOptions
  })
  const sendStructuredOption = useCallback(
    async (id: string, encoded: string): Promise<boolean> => {
      const currentState = optionStateRef.current
      const targetRecord = currentState.record
      const mutationGeneration = ++optionMutationGeneration.current
      const isCurrent = (): boolean =>
        activeOptionRecordRef.current === targetRecord &&
        optionMutationGeneration.current === mutationGeneration
      pendingOptionRef.current = id
      updateOptionState((current) => ({ ...current, pendingId: id }))
      try {
        const result = await mutate<AgentSessionOptionResult>(
          'agentSession.setOption',
          'agentSession.setOption',
          { key: id, value: encoded }
        )
        if (result && isCurrent()) {
          const committed = result.options ?? { [id]: encoded }
          updateOptionState((current) =>
            current.record === targetRecord
              ? commitStructuredAgentSessionOptionValues(current, committed)
              : current
          )
          // The launch seed names the model an effort-only pick was made under.
          rememberOptionPicks(
            structuredAgentSessionOptionView(currentState, launchSeedOptions, NO_HELD_OPTIONS),
            committed
          )
          void callStructuredAgentSession<AgentSessionOptionsResult>(
            target,
            'agentSession.options',
            { sessionId }
          )
            .then((refreshed) => {
              if (isCurrent()) {
                updateOptionState((latest) =>
                  latest.record === targetRecord && optionCatalog
                    ? applyStructuredAgentSessionOptions(latest, optionCatalog, refreshed)
                    : latest
                )
              }
            })
            .catch(() => {})
        }
        return Boolean(result)
      } finally {
        if (isCurrent()) {
          pendingOptionRef.current = null
          updateOptionState((current) =>
            current.record === targetRecord && current.pendingId === id
              ? { ...current, pendingId: null }
              : current
          )
        }
      }
    },
    [
      activeOptionRecordRef,
      launchSeedOptions,
      mutate,
      optionCatalog,
      optionMutationGeneration,
      optionStateRef,
      pendingOptionRef,
      rememberOptionPicks,
      sessionId,
      target,
      updateOptionState
    ]
  )
  const optionSnapshot = useMemo(() => {
    const snapshot = structuredAgentSessionOptionSnapshot(
      structuredAgentSessionOptionView(optionState, launchSeedOptions, held)
    )
    const locked = acceptsPicks ? snapshot : lockedStructuredAgentSessionOptionSnapshot(snapshot)
    return lockAccessWhileProviderRuns(
      locked,
      { providerStarting: args.providerStarting, providerRunning: args.providerRunning },
      optionState
    )
  }, [
    acceptsPicks,
    args.providerRunning,
    args.providerStarting,
    held,
    launchSeedOptions,
    optionState
  ])
  const setStructuredOption = useCallback(
    async (id: string, value: string | boolean): Promise<boolean> => {
      const view = structuredAgentSessionOptionView(optionStateRef.current, launchSeedOptions, held)
      const encoded = encodeStructuredAgentSessionOptionValue(id, value)
      if (
        encoded === null ||
        (id === 'accessMode' &&
          accessPickBlockedByProvider(
            { providerStarting: args.providerStarting, providerRunning: args.providerRunning },
            optionStateRef.current,
            value
          )) ||
        (id !== 'accessMode' && !optionCatalog) ||
        !canSetStructuredAgentSessionOption(view, id, value)
      ) {
        return false
      }
      if (!transportEnabled || fence === null) {
        // No fence yet: the launch holds it and applies it before anything else is sent.
        const applied = holdStructuredAgentSessionLaunchOption(sessionId, id, encoded)
        void applied?.then(settleLaunchOptionPick)
        return applied !== null
      }
      if (pendingOptionRef.current !== null) {
        return false
      }
      return sendStructuredOption(id, encoded)
    },
    [
      args.providerRunning,
      args.providerStarting,
      fence,
      held,
      launchSeedOptions,
      optionCatalog,
      optionStateRef,
      pendingOptionRef,
      sendStructuredOption,
      sessionId,
      settleLaunchOptionPick,
      transportEnabled
    ]
  )
  const setOption = useCallback(
    async (id: string, value: string | boolean) => {
      await setStructuredOption(id, value)
      // Read, not rendered: a pick the launch just took is not in this render's props yet.
      const currentHeld = getStructuredAgentSessionLaunchSelection(sessionId)?.held
      return {
        snapshot: structuredAgentSessionOptionSnapshot(
          structuredAgentSessionOptionView(
            optionStateRef.current,
            launchSeedOptions,
            currentHeld ?? NO_HELD_OPTIONS
          )
        )
      }
    },
    [launchSeedOptions, optionStateRef, sessionId, setStructuredOption]
  )
  const optionSurface = useMemo<SessionOptionsSurface>(
    () => ({
      getSnapshot: () => optionSnapshot,
      setOption,
      invokeAction: async () => ({ snapshot: optionSnapshot }),
      subscribe: () => () => {}
    }),
    [setOption, optionSnapshot]
  )

  const support =
    transportEnabled && conversationSupport?.sessionId === sessionId ? conversationSupport : null
  // Why: a tab and a hand-off label name the chat's own Pi runtime, which only this chat's options read knows.
  useRecordChatPiRuntime(sessionId, support?.piRuntime)
  const providerCommands = useStructuredProviderCommands(support?.providerCommands, mutate)
  return {
    conversationCommands: support?.commands ?? [],
    providerCommands,
    /** Absent unless this host and session can change the goal. */
    threadGoal: support?.threadGoal,
    /** Absent from a host that predates it or a session that writes no context facts. */
    connectors: transportEnabled ? connectors : undefined,
    contextUsage: support?.contextUsage,
    /** The Pi runtime the host recorded for this chat; absent until its options read answers. */
    hostPiRuntime: support?.piRuntime,
    /** Undefined until this fence's options read answers. */
    rewind: support?.fence === fence ? support.rewind : undefined,
    optionSnapshot,
    optionSurface,
    setStructuredOption,
    unavailable: hostCatalog.unavailable
  }
}
