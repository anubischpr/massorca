import { ChildProcess, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { PassThrough } from 'node:stream'
import type {
  ManagedProviderProcess,
  ProviderProcessExit
} from '../provider-process/managed-provider-process'

export type AntigravityTestProcessOptions = {
  processlessTiming?: 'before-cleanup' | 'after-cleanup-start'
}

function assertNullFreeStreams(
  child: ChildProcess,
  expected: Pick<ChildProcessWithoutNullStreams, 'stdin' | 'stdout' | 'stderr' | 'stdio'>
): asserts child is ChildProcessWithoutNullStreams {
  if (
    child.stdin !== expected.stdin ||
    child.stdout !== expected.stdout ||
    child.stderr !== expected.stderr ||
    child.stdio !== expected.stdio
  ) {
    throw new Error('fixture child streams were not installed')
  }
}

/** An owned child fixture; no executable, credential or remote host is used. */
export function antigravityTestProcess(
  conversationId = 'conversation-1',
  options: AntigravityTestProcessOptions = {}
) {
  const stdout = new PassThrough(),
    stdin = new PassThrough(),
    stderr = new PassThrough()
  const stdio: ChildProcessWithoutNullStreams['stdio'] = [stdin, stdout, stderr, null, null]
  const child = new ChildProcess()
  Object.defineProperties(child, {
    pid: { value: options.processlessTiming ? undefined : 1234 },
    stdin: { value: stdin },
    stdout: { value: stdout },
    stderr: { value: stderr },
    stdio: { value: stdio }
  })
  assertNullFreeStreams(child, { stdin, stdout, stderr, stdio })
  let root: 'live' | 'exited' = 'live'
  let observedExit: ProviderProcessExit | null = null
  const events: string[] = []
  let resolveExit = () => {}
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  const listeners: ((exit: ProviderProcessExit) => void)[] = []
  const written: string[] = []
  stdin.setEncoding('utf8').on('data', (chunk: string) => written.push(chunk))
  const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`)
  const observeExit = (value: ProviderProcessExit) => {
    if (observedExit) {
      return
    }
    observedExit = value
    root = 'exited'
    resolveExit()
    for (const listener of listeners) {
      listener(value)
    }
  }
  const exit = () => observeExit({ code: 0, signal: null, processless: false })
  const failSpawn = () => {
    events.push('processless-close')
    observeExit({ code: null, signal: null, processless: true })
  }
  const managed: ManagedProviderProcess = {
    child,
    supervised: true,
    get processless() {
      return observedExit?.processless ?? false
    },
    get rootVerdict() {
      return root
    },
    get rootExitObserved() {
      return observedExit !== null && !observedExit.processless
    },
    lastCloseResult: null,
    exitPromise,
    executableMissing: false,
    stderrTail: () => '',
    onExit: (listener) => {
      if (observedExit) {
        listener(observedExit)
      } else {
        listeners.push(listener)
      }
    },
    terminateTree: async () => {
      events.push('terminate')
      if (options.processlessTiming === 'after-cleanup-start' && !observedExit) {
        queueMicrotask(failSpawn)
        return 'unverifiable'
      }
      if (options.processlessTiming) {
        return 'unverifiable'
      }
      exit()
      return 'exited'
    },
    close: async () => {
      if (options.processlessTiming) {
        return { root, tree: null }
      }
      exit()
      return { root: 'exited', tree: 'exited' }
    }
  }
  const initialize = () =>
    queueMicrotask(() =>
      emit({ event: 'init', conversation_id: conversationId, init: { tools: [] } })
    )
  const echo = (stepIndex = 0) =>
    emit({
      event: 'step_update',
      step_update: {
        conversation_id: conversationId,
        step_index: stepIndex,
        state: 'DONE',
        step_type: 'user_input'
      }
    })
  const result = (status = 'SUCCESS', numTurns = 1) =>
    emit({
      event: 'result',
      result: {
        conversation_id: conversationId,
        status,
        response: 'answer',
        num_turns: numTurns
      }
    })
  return { managed, initialize, emit, echo, result, exit, failSpawn, events, written }
}
