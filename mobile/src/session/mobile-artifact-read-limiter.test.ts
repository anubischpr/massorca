import { describe, expect, it } from 'vitest'
import { createReadLimiter } from './mobile-artifact-read-limiter'

/** Lets every queued microtask (the chained finally that frees a slot included) run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<Value>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createReadLimiter', () => {
  it('never runs more tasks at once than its limit, in arrival order', async () => {
    const run = createReadLimiter(2)
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()]
    const started: number[] = []
    let running = 0
    let peak = 0
    const tasks = gates.map((gate, index) =>
      run(() => {
        started.push(index)
        running += 1
        peak = Math.max(peak, running)
        return gate.promise.finally(() => {
          running -= 1
        })
      })
    )
    await flush()
    expect(started).toEqual([0, 1])
    gates[0].resolve('a')
    await tasks[0]
    await flush()
    expect(started).toEqual([0, 1, 2])
    gates[1].resolve('b')
    gates[2].resolve('c')
    await expect(Promise.all(tasks)).resolves.toEqual(['a', 'b', 'c'])
    expect(peak).toBe(2)
  })

  it('frees the slot when a task rejects, and passes the rejection to its caller', async () => {
    const run = createReadLimiter(1)
    const failing = run(() => Promise.reject(new Error('host down')))
    const next = run(() => Promise.resolve('next'))
    await expect(failing).rejects.toThrow('host down')
    await expect(next).resolves.toBe('next')
  })

  it('turns a synchronous throw into a rejection without losing the slot', async () => {
    const run = createReadLimiter(1)
    const thrown = run((): Promise<string> => {
      throw new Error('sync')
    })
    const after = run(() => Promise.resolve('after'))
    await expect(thrown).rejects.toThrow('sync')
    await expect(after).resolves.toBe('after')
  })
})
