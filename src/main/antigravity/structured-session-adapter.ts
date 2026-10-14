import { randomUUID } from 'node:crypto'
import { waitForPromiseWithSignal } from '../../shared/abort-signal-reason'
import { NDJSON_MAX_LINE_BYTES } from '../../shared/main-process-ndjson-framer'
import {
  AgentSessionPreSpawnError,
  AgentSessionAcquisitionExitUnprovenError,
  AgentSessionAcquisitionRootExitObservedError,
  AgentSessionAcquisitionExitProvenError,
  AgentSessionPromptUnavailableError,
  type StructuredAgentSessionAdapter,
  type StructuredAgentSessionAcquireInput,
  type AgentSessionAcquisition
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { AgentSessionOptionRejectedError } from '../native-chat/agent-session-wire/structured-agent-session-option-error'
import {
  providerSpawnedProcessIdentity,
  PROVIDER_SPAWN_TOKEN_ENV
} from '../provider-process/provider-spawned-process-identity'
import { supportsSupervisedProviderChildLocation } from '../provider-process/supervised-provider-child-location'
import { AntigravityStructuredSession, type AntigravitySessionDeps } from './structured-session'
import {
  antigravityProviderLink,
  type AntigravityResolvedLaunch
} from './structured-launch-resolution'

export type AntigravityAdapterDeps = AntigravitySessionDeps & {
  resolveLaunch: (
    identity: StructuredAgentSessionAcquireInput['identity'],
    options?: Readonly<Record<string, string>>
  ) => Promise<AntigravityResolvedLaunch>
  readProcessStartTime?: (pid: number) => Promise<number | null>
}

export class AntigravityStructuredSessionAdapter implements StructuredAgentSessionAdapter {
  private readonly sessions = new Map<string, AntigravityStructuredSession>()
  private readonly acquiring = new Set<string>()
  private readonly lifetime = new AbortController()
  constructor(private readonly deps: AntigravityAdapterDeps) {}
  supportsLocation = supportsSupervisedProviderChildLocation
  supportsCreate = (
    location: Parameters<NonNullable<StructuredAgentSessionAdapter['supportsCreate']>>[0],
    agent: string
  ) => agent === 'antigravity' && this.supportsLocation(location)

  async acquire(input: StructuredAgentSessionAcquireInput): Promise<AgentSessionAcquisition> {
    const id = input.identity.sessionId
    if (this.acquiring.has(id) || this.sessions.has(id)) {
      throw new AgentSessionPreSpawnError('Antigravity session already owns a child')
    }
    this.acquiring.add(id)
    let session: AntigravityStructuredSession | undefined
    try {
      const signal = AbortSignal.any([
        this.lifetime.signal,
        AbortSignal.timeout(30_000),
        ...(input.signal ? [input.signal] : [])
      ])
      const launch = await waitForPromiseWithSignal(
        this.deps.resolveLaunch(input.identity, input.options),
        signal
      )
      if (signal.aborted) {
        throw new AgentSessionPreSpawnError('Antigravity start was cancelled')
      }
      session = new AntigravityStructuredSession(
        input,
        randomUUID(),
        {
          ...launch,
          env: {
            ...launch.env,
            [PROVIDER_SPAWN_TOKEN_ENV]: input.spawnToken,
            ORCA_AGENT_SESSION_ID: id
          }
        },
        this.deps
      )
      this.sessions.set(id, session)
      const spawned = providerSpawnedProcessIdentity(
        input,
        'Antigravity',
        this.deps.readProcessStartTime
      )
      if (session.process.child.pid !== undefined) {
        await spawned.onSpawned(session.process.child.pid)
      }
      const process = await spawned.read(session.process.child.pid)
      const conversation = await waitForPromiseWithSignal(session.transport.ready, signal)
      if (session.process.rootVerdict === 'exited') {
        throw new Error('Antigravity exited while starting')
      }
      return {
        process,
        acquisitionGeneration: session.generation,
        link: antigravityProviderLink(launch, conversation, input.fence)
      }
    } catch (error) {
      if (!session) {
        throw new AgentSessionPreSpawnError(error)
      }
      const proven = await session.close(false).catch(() => false)
      if (proven) {
        throw new AgentSessionAcquisitionExitProvenError(error)
      }
      if (session.process.rootVerdict === 'exited') {
        throw new AgentSessionAcquisitionRootExitObservedError(error)
      }
      throw new AgentSessionAcquisitionExitUnprovenError(error)
    } finally {
      this.acquiring.delete(id)
    }
  }

  dispatch: StructuredAgentSessionAdapter['dispatch'] = async (input) => {
    const session = this.session(input.sessionId, input.fence)
    if (input.body.blocks.some((block) => block.type !== 'text')) {
      throw new Error('Antigravity structured prompts support text only')
    }
    const text = input.body.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
    if (
      Buffer.byteLength(JSON.stringify({ event: 'user', message: { content: text } })) + 1 >
      NDJSON_MAX_LINE_BYTES
    ) {
      throw new Error('Antigravity prompt exceeds the stream frame limit')
    }
    await input.beforeDispatch?.()
    if (this.session(input.sessionId, input.fence) !== session) {
      throw new Error('Antigravity acquisition changed before dispatch')
    }
    session.submit(input.clientMessageId, text, input.requestedAt)
    return { state: 'admitted' }
  }
  cancelTurn: StructuredAgentSessionAdapter['cancelTurn'] = async (input) => {
    const session = this.session(input.sessionId, input.fence)
    const turnId = input.resolveLiveTurnId ? input.resolveLiveTurnId() : session.lane.openTurnId
    if (input.turnId !== undefined && input.turnId !== turnId) {
      return { cancelled: false }
    }
    if (!turnId && session.pending.size === 0) {
      return { cancelled: false }
    }
    const cancelled = await session.close()
    return { cancelled, ...(turnId ? { turnId } : {}) }
  }
  stopEndsSession(): boolean {
    return true
  }
  answerPrompt: StructuredAgentSessionAdapter['answerPrompt'] = async (input) => {
    throw new AgentSessionPromptUnavailableError(input.itemId)
  }
  setOption: StructuredAgentSessionAdapter['setOption'] = async () => {
    throw new AgentSessionOptionRejectedError('Antigravity options apply on the next acquisition')
  }
  readAcquisitionOptions: NonNullable<StructuredAgentSessionAdapter['readAcquisitionOptions']> = (
    input
  ) => this.session(input.sessionId, input.fence).input.options
  holdsDispatch(id: string): boolean {
    return (this.sessions.get(id)?.pending.size ?? 0) > 0
  }
  holdsLiveProviderProcess(id: string, generation: string): boolean {
    const session = this.sessions.get(id)
    return session?.generation === generation && session.process.rootVerdict === 'live'
  }
  async closeSession(id: string, requested = true): Promise<boolean> {
    const session = this.sessions.get(id)
    if (!session) {
      return true
    }
    if (await session.close(requested)) {
      return true
    }
    if (session.process.rootVerdict === 'exited') {
      throw new AgentSessionAcquisitionRootExitObservedError('Antigravity root exit observed')
    }
    return false
  }
  releaseAcquisition = (input: { sessionId: string }) => this.closeSession(input.sessionId)
  disposeSession = (id: string) => this.closeSession(id)
  forceCloseSession = (id: string) => this.closeSession(id, false)
  acknowledgeSessionRelease(id: string): void {
    const session = this.sessions.get(id)
    if (session?.process.rootVerdict !== 'exited') {
      return
    }
    session.retire()
    this.sessions.delete(id)
  }
  async closeAll(): Promise<void> {
    this.lifetime.abort(new Error('Antigravity adapter is closing'))
    await Promise.all([...this.sessions.keys()].map((id) => this.closeSession(id)))
  }
  async drainObservedExits(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.drainObservedExit()))
  }
  private session(id: string, fence: number): AntigravityStructuredSession {
    const session = this.sessions.get(id)
    if (!session || session.input.fence !== fence || session.process.rootVerdict !== 'live') {
      throw new Error('Antigravity session is not live under this fence')
    }
    return session
  }
}
