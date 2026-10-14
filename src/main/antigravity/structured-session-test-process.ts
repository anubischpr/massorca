import { ChildProcess, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { PassThrough } from 'node:stream'
import type {
  ManagedProviderProcess,
  ProviderProcessExit
} from '../provider-process/managed-provider-process'

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
export function antigravityTestProcess(conversationId = 'conversation-1') {
  const stdout = new PassThrough(),
    stdin = new PassThrough(),
    stderr = new PassThrough()
  const stdio: ChildProcessWithoutNullStreams['stdio'] = [stdin, stdout, stderr, null, null]
  const child = new ChildProcess()
  Object.defineProperties(child, {
    pid: { value: 1234 },
    stdin: { value: stdin },
    stdout: { value: stdout },
    stderr: { value: stderr },
    stdio: { value: stdio }
  })
  assertNullFreeStreams(child, { stdin, stdout, stderr, stdio })
  let root: 'live' | 'exited' = 'live'
  let resolveExit = () => {}
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  const listeners: ((exit: ProviderProcessExit) => void)[] = []
  const written: string[] = []
  stdin.setEncoding('utf8').on('data', (chunk: string) => written.push(chunk))
  const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`)
  const exit = () => {
    if (root === 'exited') {
      return
    }
    root = 'exited'
    resolveExit()
    for (const listener of listeners) {
      listener({ code: 0, signal: null, processless: false })
    }
  }
  const managed: ManagedProviderProcess = {
    child,
    supervised: true,
    processless: false,
    get rootVerdict() {
      return root
    },
    get rootExitObserved() {
      return root === 'exited'
    },
    lastCloseResult: null,
    exitPromise,
    executableMissing: false,
    stderrTail: () => '',
    onExit: (listener) => {
      listeners.push(listener)
    },
    terminateTree: async () => {
      exit()
      return 'exited'
    },
    close: async () => {
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
  return { managed, initialize, emit, echo, result, exit, written }
}
