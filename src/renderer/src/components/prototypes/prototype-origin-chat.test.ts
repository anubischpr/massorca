import { describe, expect, it } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import { originChatOf } from './prototype-origin-chat'

const PARENT = 'parent-session'

function agentTab(worktreeId: string, entityId: string, label: string, customLabel: string | null) {
  // SAFETY: the lookup reads only the fields set here; the rest of Tab is not used by originChatOf.
  return {
    id: `tab-${entityId}`,
    worktreeId,
    entityId,
    contentType: 'agent-session',
    label,
    customLabel
  } as unknown as Tab
}

describe('originChatOf', () => {
  it('finds the parent chat in whichever worktree holds its tab, with its name', () => {
    const tabs = {
      'worktree-a': [agentTab('worktree-a', 'other', 'Other', null)],
      'worktree-b': [agentTab('worktree-b', PARENT, 'nexuscare-planning', null)]
    }
    expect(originChatOf(tabs, PARENT)).toEqual({
      worktreeId: 'worktree-b',
      title: 'nexuscare-planning'
    })
  })

  it('prefers the name the user gave the chat over the generated label', () => {
    const tabs = {
      'worktree-a': [agentTab('worktree-a', PARENT, 'generated', '  mine  ')]
    }
    expect(originChatOf(tabs, PARENT)?.title).toBe('mine')
  })

  it('is null when this client holds no tab for the chat, so the origin part is dropped', () => {
    expect(originChatOf({ 'worktree-a': [] }, PARENT)).toBeNull()
  })

  it('is null when the tab has no name to show', () => {
    const tabs = { 'worktree-a': [agentTab('worktree-a', PARENT, '   ', null)] }
    expect(originChatOf(tabs, PARENT)).toBeNull()
  })
})
