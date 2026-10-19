import { describe, expect, it } from 'vitest'
import { PiRpcContextUsage } from './rpc-context-usage'

const model = { provider: 'anthropic', id: 'model-1', contextWindow: 1_000_000 }

function usedKinds(events: ReturnType<PiRpcContextUsage['setModel']>): (string | undefined)[] {
  return events.map((event) => (event.type === 'context.usage' ? event.usage.used?.kind : 'x'))
}

describe('PiRpcContextUsage model tracking', () => {
  it('keeps a fresh report when the settled state names the same model', () => {
    const usage = new PiRpcContextUsage()
    usage.setModel(model, 1)
    usage.stats({ contextUsage: { tokens: 29_441, contextWindow: 1_000_000, percent: 2.9 } }, 2)
    expect(usage.modelChanged({ ...model })).toBe(false)
    expect(usedKinds(usage.setModel({ ...model }, 3))).toEqual([undefined])
  })

  it('marks usage unknown only when the model really changed', () => {
    const usage = new PiRpcContextUsage()
    usage.setModel(model, 1)
    const next = { ...model, id: 'model-2' }
    expect(usage.modelChanged(next)).toBe(true)
    expect(usedKinds(usage.setModel(next, 2))).toEqual(['unknown'])
  })
})
