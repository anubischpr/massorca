import { describe, expect, it } from 'vitest'
import { isAiVaultAutomatedRun } from '../../../../shared/ai-vault-automated-run'
import { searchHit } from '../../../../shared/ai-vault-search-test-fixture'
import {
  aiVaultSearchHitToSession,
  canResumeAiVaultSearchHit,
  hasAiVaultSearchHitPath,
  markAutomatedAiVaultSearchRows
} from './ai-vault-search-session'

describe('markAutomatedAiVaultSearchRows', () => {
  const remoteHit = {
    ...searchHit(),
    title: 'Plan for the project',
    source: { presence: 'unverifiable' as const }
  }
  const row = aiVaultSearchHitToSession(remoteHit, 'runtime:cloud')
  const listedRun = {
    ...row,
    id: 'runtime:cloud:codex:host-session:/host/transcript.jsonl',
    filePath: '/host/transcript.jsonl',
    previewMessages: [
      {
        role: 'user' as const,
        text: "Name this chat from the user's first request.",
        timestamp: null
      }
    ]
  }

  it('hides a titled background run the list recognized, though the hit has no path', () => {
    const [marked] = markAutomatedAiVaultSearchRows([row], [listedRun])
    expect(marked.headlessRun).toBe(true)
    expect(isAiVaultAutomatedRun(marked)).toBe(true)
  })

  it('leaves a user chat, and the same session on another host', () => {
    const userChat = { ...listedRun, previewMessages: [] }
    const otherHost = { ...listedRun, executionHostId: 'local' as const }
    expect(markAutomatedAiVaultSearchRows([row], [userChat])[0].headlessRun).toBeUndefined()
    expect(markAutomatedAiVaultSearchRows([row], [otherHost])[0].headlessRun).toBeUndefined()
  })
})

describe('aiVaultSearchHitToSession', () => {
  it('uses the selected execution host and only host-provided source fields', () => {
    const hit = { ...searchHit(), executionHostId: 'local' }
    const session = aiVaultSearchHitToSession(hit, 'ssh:paired-host')

    expect(session.executionHostId).toBe('ssh:paired-host')
    expect(session.id).toBe('ssh:paired-host:codex:host-session:/host/transcript.jsonl')
    expect(session.filePath).toBe('/host/transcript.jsonl')
    expect(session.resumeCommand).toBe('host-resume-command')
    expect(session.previewMessages).toEqual([])
  })

  it('does not invent a path or resume command when transport withholds them', () => {
    const hit = {
      ...searchHit(),
      source: { presence: 'unverifiable' as const },
      resumeCommand: undefined
    }
    const session = aiVaultSearchHitToSession(hit, 'runtime:cloud')

    expect(session.filePath).toBe('')
    expect(session.resumeCommand).toBe('')
    expect(canResumeAiVaultSearchHit(hit)).toBe(false)
    expect(hasAiVaultSearchHitPath(hit)).toBe(false)
  })

  it('opens a native chat hit through its owner when transport withholds the command', () => {
    const hit = {
      ...searchHit(),
      source: { presence: 'present' as const },
      resumeCommand: undefined,
      structuredSession: { sessionId: 'native-session', workspaceId: 'host-workspace' }
    }

    expect(canResumeAiVaultSearchHit(hit)).toBe(true)
    expect(hasAiVaultSearchHitPath(hit)).toBe(false)
  })

  it('gates resume and path actions on their own source fields', () => {
    const withoutResume = { ...searchHit(), resumeCommand: undefined }

    expect(canResumeAiVaultSearchHit(withoutResume)).toBe(false)
    expect(hasAiVaultSearchHitPath(withoutResume)).toBe(true)
  })
})
