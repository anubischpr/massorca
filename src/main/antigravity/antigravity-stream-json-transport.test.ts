import { ChildProcess } from 'node:child_process'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type {
  ManagedProviderProcess,
  ProviderProcessExit
} from '../provider-process/managed-provider-process'
import type { ProviderProcessLaunch } from '../provider-process/provider-process-launch'
import {
  AntigravityStreamJsonTransport,
  AntigravityStreamProtocolError,
  type AntigravityStreamTransportEvent
} from './antigravity-stream-json-transport'

type Fixture = {
  transport: AntigravityStreamJsonTransport
  stdout: PassThrough
  stdin: PassThrough
  events: AntigravityStreamTransportEvent[]
  errors: Error[]
  written: string[]
  exit: (result: ProviderProcessExit) => void
  terminateTree: ReturnType<typeof vi.fn>
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

function fixture(maxLineBytes?: number): Fixture {
  const stdout = new PassThrough()
  const stdin = new PassThrough()
  const stderr = new PassThrough()
  const stdio: ChildProcessWithoutNullStreams['stdio'] = [stdin, stdout, stderr, null, null]
  const child = new ChildProcess()
  Object.defineProperties(child, {
    pid: { value: 123 },
    stdin: { value: stdin },
    stdout: { value: stdout },
    stderr: { value: stderr },
    stdio: { value: stdio }
  })
  assertNullFreeStreams(child, { stdin, stdout, stderr, stdio })
  vi.spyOn(child, 'kill').mockReturnValue(true)
  const written: string[] = []
  stdin.setEncoding('utf8').on('data', (chunk: string) => written.push(chunk))
  let exit = (_result: ProviderProcessExit): void => {}
  const terminateTree = vi.fn(async () => 'exited' as const)
  const managed: ManagedProviderProcess = {
    child,
    supervised: false,
    processless: false,
    rootVerdict: 'live',
    rootExitObserved: false,
    lastCloseResult: null,
    exitPromise: new Promise<void>(() => {}),
    executableMissing: false,
    stderrTail: () => '',
    onExit: (listener: (result: ProviderProcessExit) => void) => {
      exit = listener
    },
    terminateTree,
    close: vi.fn(async () => ({ root: 'exited' as const, tree: null }))
  }
  const events: AntigravityStreamTransportEvent[] = []
  const errors: Error[] = []
  const transport = new AntigravityStreamJsonTransport({
    launch: {
      command: 'agy',
      args: ['--input-format', 'stream-json', '--output-format', 'stream-json']
    },
    onEvent: (event) => events.push(event),
    onError: (error) => errors.push(error),
    ...(maxLineBytes === undefined ? {} : { maxLineBytes }),
    processFactory: (_launch: ProviderProcessLaunch) => managed
  })
  return {
    transport,
    stdout,
    stdin,
    events,
    errors,
    written,
    get exit() {
      return exit
    },
    terminateTree
  }
}

function emitJson(target: PassThrough, value: unknown): void {
  target.write(`${JSON.stringify(value)}\n`)
}

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

function init(conversationId = 'conversation-1'): unknown {
  return { event: 'init', conversation_id: conversationId, init: { tools: [] } }
}

function step(
  conversationId: string,
  stepIndex: number,
  stepType: string,
  state: 'ACTIVE' | 'DONE' = 'DONE',
  textDelta?: string
): unknown {
  return {
    event: 'step_update',
    step_update: {
      conversation_id: conversationId,
      step_index: stepIndex,
      state,
      step_type: stepType,
      ...(textDelta === undefined ? {} : { text_delta: textDelta })
    }
  }
}

function result(
  conversationId: string,
  numTurns: number,
  response = 'answer',
  status = 'SUCCESS'
): unknown {
  return {
    event: 'result',
    result: { conversation_id: conversationId, status, response, num_turns: numTurns }
  }
}

afterEach(() => vi.restoreAllMocks())

describe('Antigravity stream-json transport', () => {
  it('waits for init, frames fragmented NDJSON, and accepts only the echoed user_input', async () => {
    const rig = fixture()
    const turn = rig.transport.submitPrompt('send-1', 'hello')
    expect(rig.written).toEqual([])
    rig.stdout.write('{"event":"init","conversation_id":"conversation-1"}\n'.slice(0, 18))
    rig.stdout.write('{"event":"init","conversation_id":"conversation-1"}\n'.slice(18))
    await expect(rig.transport.ready).resolves.toBe('conversation-1')
    await nextTurn()
    expect(JSON.parse(rig.written[0])).toEqual({ event: 'user', message: { content: 'hello' } })
    expect(rig.events.filter((event) => event.type === 'step_update')).toEqual([])
    emitJson(rig.stdout, step('conversation-1', 0, 'user_input'))
    emitJson(rig.stdout, step('conversation-1', 1, 'agent_response', 'ACTIVE', 'hel'))
    emitJson(rig.stdout, step('conversation-1', 1, 'agent_response', 'ACTIVE', 'lo'))
    emitJson(rig.stdout, result('conversation-1', 1, 'hello'))
    await expect(turn).resolves.toMatchObject({ status: 'SUCCESS', response: 'hello' })
    expect(rig.events.filter((event) => event.type === 'step_update')).toHaveLength(3)
    expect(rig.events.filter((event) => event.type === 'result')).toMatchObject([
      { clientMessageId: 'send-1', terminal: true }
    ])
  })

  it('serializes concurrent prompts until the preceding terminal result', async () => {
    const rig = fixture()
    const first = rig.transport.submitPrompt('send-1', 'first')
    const second = rig.transport.submitPrompt('send-2', 'second')
    emitJson(rig.stdout, init())
    await nextTurn()
    expect(rig.written).toHaveLength(1)
    emitJson(rig.stdout, step('conversation-1', 0, 'user_input'))
    emitJson(rig.stdout, result('conversation-1', 1, 'one'))
    await expect(first).resolves.toMatchObject({ num_turns: 1 })
    await nextTurn()
    expect(rig.written).toHaveLength(2)
    let secondSettled = false
    void second.then(() => {
      secondSettled = true
    })
    emitJson(rig.stdout, step('conversation-1', 0, 'user_input'))
    await nextTurn()
    expect(secondSettled).toBe(false)
    expect(rig.events.filter((event) => event.type === 'step_update')).toHaveLength(1)
    emitJson(rig.stdout, step('conversation-1', 2, 'user_input'))
    emitJson(rig.stdout, result('conversation-1', 1, 'stale duplicate'))
    await nextTurn()
    expect(secondSettled).toBe(false)
    emitJson(rig.stdout, result('conversation-1', 2, 'two'))
    await expect(second).resolves.toMatchObject({ num_turns: 2 })
  })

  it('rejects mismatched conversation ids and terminates the managed tree', async () => {
    const rig = fixture()
    const turn = rig.transport.submitPrompt('send-1', 'hello')
    emitJson(rig.stdout, init())
    await nextTurn()
    emitJson(rig.stdout, step('other-conversation', 0, 'user_input'))
    await expect(turn).rejects.toBeInstanceOf(AntigravityStreamProtocolError)
    expect(rig.errors[0]?.message).toContain('conversation_id does not match init')
    expect(rig.terminateTree).toHaveBeenCalledOnce()
  })

  it('fails malformed and oversized NDJSON instead of accepting partial records', async () => {
    const invalid = fixture()
    invalid.stdout.write('{bad-json}\n')
    await expect(invalid.transport.ready).rejects.toThrow('Invalid Antigravity NDJSON')

    const oversized = fixture(12)
    oversized.stdout.write('{"event":"init","conversation_id":"long"}\n')
    await expect(oversized.transport.ready).rejects.toThrow('line exceeded 12 bytes')
    expect(oversized.errors[0]).toBeInstanceOf(AntigravityStreamProtocolError)
  })

  it('treats process exit before a terminal result as an error, never success', async () => {
    const rig = fixture()
    const turn = rig.transport.submitPrompt('send-1', 'hello')
    emitJson(rig.stdout, init())
    await nextTurn()
    emitJson(rig.stdout, step('conversation-1', 0, 'user_input'))
    rig.exit({ code: 0, signal: null, processless: false })
    await expect(turn).rejects.toThrow('without a terminal result')
    expect(rig.errors).toHaveLength(1)
  })

  it('rejects prompts after the child exits while idle', async () => {
    const rig = fixture()
    emitJson(rig.stdout, init())
    await expect(rig.transport.ready).resolves.toBe('conversation-1')

    rig.exit({ code: 0, signal: null, processless: false })

    const latePrompt = rig.transport.submitPrompt('send-1', 'late prompt')
    const outcome = await Promise.race([
      latePrompt.then(
        () => 'resolved',
        (error: Error) => error.message
      ),
      nextTurn().then(() => 'still pending')
    ])
    expect(outcome).toContain('exited unexpectedly while idle')
    expect(rig.written).toHaveLength(0)
    expect(rig.errors).toHaveLength(1)
  })

  it('does not report an exit after an intentional close', async () => {
    const rig = fixture()
    emitJson(rig.stdout, init())
    await expect(rig.transport.ready).resolves.toBe('conversation-1')
    await rig.transport.close()

    rig.exit({ code: 0, signal: null, processless: false })

    expect(rig.errors).toHaveLength(0)
  })

  it('rejects an in-flight prompt when its process is terminated', async () => {
    const rig = fixture()
    const turn = rig.transport.submitPrompt('send-1', 'hello')
    emitJson(rig.stdout, init())
    await nextTurn()
    emitJson(rig.stdout, step('conversation-1', 0, 'user_input'))
    await nextTurn()

    const terminated = rig.transport.terminate()
    rig.exit({ code: null, signal: 'SIGTERM', processless: false })

    await expect(turn).rejects.toThrow('without a terminal result')
    await terminated
  })

  it('does not complete a turn on WAITING or RUNNING result envelopes', async () => {
    const rig = fixture()
    const turn = rig.transport.submitPrompt('send-1', 'hello')
    emitJson(rig.stdout, init())
    await nextTurn()
    emitJson(rig.stdout, step('conversation-1', 0, 'user_input'))
    emitJson(rig.stdout, result('conversation-1', 1, '', 'WAITING'))
    emitJson(rig.stdout, result('conversation-1', 1, '', 'RUNNING'))
    await nextTurn()
    expect(rig.events.filter((event) => event.type === 'result')).toHaveLength(2)
    emitJson(rig.stdout, step('conversation-1', 1, 'agent_response', 'ACTIVE', 'answer'))
    emitJson(rig.stdout, result('conversation-1', 1, 'answer'))
    await expect(turn).resolves.toMatchObject({ status: 'SUCCESS' })
  })
})
