import { describe, expect, it } from 'vitest'
import { listedDesignSystemOf } from './prototype-request-listing'

const ENTRY = {
  projectKey: 'project-key-0001',
  projectName: 'nexuscare',
  status: 'detected',
  version: 2,
  tokenCount: 3,
  agent: 'Codex',
  swatches: ['#2563eb']
}

describe('listedDesignSystemOf', () => {
  it('keeps an entry the list contract accepts, as it is', () => {
    expect(listedDesignSystemOf(ENTRY)).toEqual(ENTRY)
  })

  it('keeps the request a proposed system waits on', () => {
    const pendingRequest = {
      requestId: '20261028-201500-abcdef',
      sessionId: 'session-1',
      agent: 'claude'
    }
    expect(listedDesignSystemOf({ ...ENTRY, pendingRequest })).toEqual({ ...ENTRY, pendingRequest })
  })

  it('drops an entry the list contract refuses, so it cannot fail the whole reply', () => {
    expect(listedDesignSystemOf({ ...ENTRY, swatches: ['x'.repeat(65)] })).toBeNull()
    expect(listedDesignSystemOf({ ...ENTRY, projectName: '' })).toBeNull()
  })
})
