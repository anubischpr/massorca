import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { DelegatedChildFirstPromptDeps } from '../delegated-session/delegated-child-first-prompt'
import { botTeamPrototypeFirstPrompt } from './bot-team-task-prototype'

describe('the prototype first prompt of a bot task', () => {
  it('makes the request for the bot session with the count the person chose', async () => {
    const createRequest = vi.fn(async () => ({
      ok: true as const,
      requestId: 'req-1',
      folderPath: '/state/req-1'
    }))
    const deps: DelegatedChildFirstPromptDeps = {
      readChat: async () => ({ agent: 'claude', launchDirectory: '/work', workspaceId: 'ws' }),
      readPrototypeCount: () => ({ mode: 'always', count: 2 }),
      createRequest,
      removeFolder: vi.fn(async () => {})
    }
    const prompt = await botTeamPrototypeFirstPrompt(
      {} as OrcaRuntimeService,
      deps
    )({
      childSessionId: 'session-1',
      taskSpec: 'una landing para el taller',
      count: 3,
      designSystem: 'propose'
    })

    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        originSessionId: 'session-1',
        count: 3,
        designSystem: 'propose'
      })
    )
    expect(prompt?.body).toContain('una landing para el taller')
    expect(prompt?.appendix).not.toBe('')
  })

  it('sends an artifact task as written, though the person chose a count for the room', async () => {
    const createRequest = vi.fn(async () => ({
      ok: true as const,
      requestId: 'req-2',
      folderPath: '/state/req-2'
    }))
    const deps: DelegatedChildFirstPromptDeps = {
      readChat: async () => ({ agent: 'claude', launchDirectory: '/work', workspaceId: 'ws' }),
      readPrototypeCount: () => ({ mode: 'always', count: 2 }),
      createRequest,
      removeFolder: vi.fn(async () => {})
    }
    const prompt = await botTeamPrototypeFirstPrompt(
      {} as OrcaRuntimeService,
      deps
    )({
      childSessionId: 'session-2',
      taskSpec:
        'Crea un artifact interactivo HTML donde pueda visualizarse el impacto probable de estas mejoras.',
      count: 3
    })

    expect(prompt).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('sends a plan or exploration task as written, though the person chose a count for the room', async () => {
    const createRequest = vi.fn(async () => ({
      ok: true as const,
      requestId: 'req-3',
      folderPath: '/state/req-3'
    }))
    const deps: DelegatedChildFirstPromptDeps = {
      readChat: async () => ({ agent: 'claude', launchDirectory: '/work', workspaceId: 'ws' }),
      readPrototypeCount: () => ({ mode: 'always', count: 2 }),
      createRequest,
      removeFolder: vi.fn(async () => {})
    }
    const prompt = await botTeamPrototypeFirstPrompt(
      {} as OrcaRuntimeService,
      deps
    )({
      childSessionId: 'session-3',
      taskSpec:
        'En NexusCare, crea un plan de exploración y explora el proyecto con sub agentes en búsqueda de puntos de mejora con Jev AI.',
      count: 3
    })

    expect(prompt).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
  })
})
