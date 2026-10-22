import { describe, expect, it, vi } from 'vitest'
import {
  nativeChatClientCommandNames,
  nativeChatClientCommandRows,
  nativeChatClientCommandSurface,
  type NativeChatClientCommandActions
} from './native-chat-client-commands'

function actions(): NativeChatClientCommandActions {
  return {
    status: vi.fn(() => true),
    context: vi.fn(() => true),
    permissions: vi.fn(async () => true),
    copy: vi.fn(async () => true),
    export: vi.fn(async () => true),
    mention: vi.fn(() => true),
    rename: vi.fn(() => true)
  }
}

describe('client commands by agent', () => {
  it('answers the shared commands for every agent', () => {
    expect(nativeChatClientCommandNames('claude')).toEqual([
      'status',
      'context',
      'permissions',
      'copy'
    ])
  })

  it('answers /export and /mention for Codex, and /open and /rename for agy', () => {
    expect(nativeChatClientCommandNames('codex')).toEqual([
      'status',
      'context',
      'permissions',
      'copy',
      'export',
      'mention'
    ])
    expect(nativeChatClientCommandNames('antigravity')).toEqual([
      'status',
      'context',
      'permissions',
      'copy',
      'open',
      'rename'
    ])
  })

  it('lists in the menu only the client commands the agent catalog claims', () => {
    const codex = nativeChatClientCommandRows('codex').map((row) => row.name)
    expect(codex).toEqual(expect.arrayContaining(['status', 'copy', 'permissions', 'export']))
    expect(codex).not.toContain('context')
    // agy expands its commands from text, so its menu keeps its captured list.
    expect(nativeChatClientCommandRows('antigravity')).toEqual([])
  })

  it('hands each agent only the callbacks it answers', () => {
    const codex = nativeChatClientCommandSurface('codex', actions())
    expect(codex.export).toBeDefined()
    expect(codex.mention).toBeDefined()
    expect(codex.open).toBeUndefined()
    expect(codex.rename).toBeUndefined()
    const agy = nativeChatClientCommandSurface('antigravity', actions())
    expect(agy.open).toBeDefined()
    expect(agy.rename).toBeDefined()
    expect(agy.export).toBeUndefined()
    expect(agy.mention).toBeUndefined()
    const claude = nativeChatClientCommandSurface('claude', actions())
    expect(claude.status).toBeDefined()
    expect(claude.export).toBeUndefined()
  })
})
