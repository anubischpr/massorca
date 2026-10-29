import { describe, expect, it } from 'vitest'
import type { AgentSessionDeclaredAccess } from '../../../../../../shared/agent-session-access-mode'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import {
  assertWorkerStartAccessModeApplies,
  declaredAccessForStructuredAgent,
  resolveWorkerStartAccessMode
} from './worker-start-access-mode'

const declare = (
  modes: AgentSessionDeclaredAccess['modes'],
  presets: AgentSessionDeclaredAccess['presets'] = []
): AgentSessionDeclaredAccess => ({ modes, presets, explicit: [...modes, ...presets] })

const resolve = (
  requested: Parameters<typeof resolveWorkerStartAccessMode>[0]['requested'],
  declared: AgentSessionDeclaredAccess | undefined
) => resolveWorkerStartAccessMode({ agent: 'codex', requested, declared })

describe('resolveWorkerStartAccessMode', () => {
  it('keeps the chat default when no mode or inherit is asked for', () => {
    expect(resolve(undefined, declare(['default']))).toBeUndefined()
    expect(resolve('inherit', declare(['default']))).toBeUndefined()
  })

  it('honours a mode the agent declares', () => {
    expect(resolve('default', declare(['default', 'full-access']))).toBe('default')
    expect(resolve('read-only', declare(['default'], ['read-only']))).toBe('read-only')
    expect(resolve('full-access', declare(['default', 'full-access']))).toBe('full-access')
  })

  it('narrows to the safest declared mode that is no more permissive than the request', () => {
    expect(resolve('accept-edits', declare(['default'], ['auto', 'read-only']))).toBe('read-only')
    expect(resolve('full-access', declare(['default']))).toBe('default')
  })

  it('never widens: a restricted request is refused when only full access is declared', () => {
    expect(() => resolve('default', declare(['full-access']))).toThrow(OrchestrationError)
    expect(() => resolve('plan', declare(['default', 'full-access']))).toThrow(
      /codex cannot run a worker in plan access/
    )
  })

  it('refuses a mode when the agent declares no access at all', () => {
    expect(() => resolve('read-only', undefined)).toThrow(OrchestrationError)
  })
})

describe('assertWorkerStartAccessModeApplies', () => {
  it('passes when no explicit mode is asked for', () => {
    expect(() => assertWorkerStartAccessModeApplies({ requested: undefined })).not.toThrow()
    expect(() =>
      assertWorkerStartAccessModeApplies({ requested: 'inherit', terminal: 'term_1' })
    ).not.toThrow()
  })

  it('refuses an explicit mode on a reused terminal or a remote server', () => {
    expect(() =>
      assertWorkerStartAccessModeApplies({ requested: 'default', terminal: 'term_1' })
    ).toThrow(/cannot be applied when reusing/)
    expect(() =>
      assertWorkerStartAccessModeApplies({ requested: 'default', on: 'server-1' })
    ).toThrow(/another server/)
  })
})

describe('declaredAccessForStructuredAgent', () => {
  it('reads the modes each registered agent declares', () => {
    expect(declaredAccessForStructuredAgent('codex')?.explicit).toEqual(
      expect.arrayContaining(['default', 'full-access', 'read-only'])
    )
    expect(declaredAccessForStructuredAgent('pi')?.explicit).toEqual(['full-access'])
  })

  it('reports no declaration for an agent with no structured registration', () => {
    expect(declaredAccessForStructuredAgent('cursor')).toBeUndefined()
  })
})
