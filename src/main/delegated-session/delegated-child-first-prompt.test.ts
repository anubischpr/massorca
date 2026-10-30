import { describe, expect, it, vi } from 'vitest'
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../shared/rpc-contract/prototype-params'
import { prototypeRequestMarkerLine } from '../../shared/prototype-hidden-instruction'
import { designSystemRequestInstruction } from '../../shared/prototype-design-system-instruction'
import {
  delegatedChildFirstPrompt,
  prototypeAgentOfChild,
  type DelegatedChildFirstPromptDeps
} from './delegated-child-first-prompt'

const CHILD = 'child-session'
const PARENT = 'parent-session'
const REQUEST = 'request-1'
const FOLDER = '/state/visuals/child/prototypes/request-1'
const NEXUS_TASK =
  'Crea una sesión hija que diseñe una nueva versión de la pantalla de NexusCare donde actualmente se procesan las liquidaciones en la fase 1, 2 y 3.'

function fakeDeps(overrides: Partial<DelegatedChildFirstPromptDeps> = {}) {
  const createRequest = vi.fn<DelegatedChildFirstPromptDeps['createRequest']>(async () => ({
    ok: true as const,
    requestId: REQUEST,
    folderPath: FOLDER
  }))
  const removeFolder = vi.fn<DelegatedChildFirstPromptDeps['removeFolder']>(async () => undefined)
  const deps: DelegatedChildFirstPromptDeps = {
    readChat: async () => ({
      agent: 'claude',
      launchDirectory: '/repo',
      workspaceId: 'workspace-1'
    }),
    hasDesignSystem: async () => true,
    readPrototypeCount: () => ({ mode: 'always', count: 3 }),
    createRequest,
    removeFolder,
    ...overrides
  }
  return { deps, createRequest, removeFolder }
}

function promptInput(taskSpec: string) {
  return { childSessionId: CHILD, originSessionId: PARENT, taskSpec }
}

describe('delegatedChildFirstPrompt', () => {
  it('leaves a task that does not ask for a prototype unmade and undelivered as stored', async () => {
    const { deps, createRequest } = fakeDeps()
    expect(await delegatedChildFirstPrompt(promptInput('Fix the failing build'), deps)).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('makes the request for the child with the Settings count, the chat and its origin', async () => {
    const { deps, createRequest } = fakeDeps()
    await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(createRequest).toHaveBeenCalledWith({
      sessionId: CHILD,
      launchDirectory: '/repo',
      worktreeId: 'workspace-1',
      originSessionId: PARENT,
      agent: 'claude',
      count: 3,
      designSystem: 'use',
      text: NEXUS_TASK
    })
  })

  it('appends the hidden instruction after the body, with the design system in use', async () => {
    const { deps } = fakeDeps()
    const prompt = await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(prompt?.body).toBe(NEXUS_TASK)
    expect(prompt?.appendix).toContain(prototypeRequestMarkerLine(REQUEST))
    expect(prompt?.appendix).toContain(designSystemRequestInstruction())
  })

  it('asks for no design system in a project that has none, and goes straight to the directions', async () => {
    const { deps, createRequest } = fakeDeps({ hasDesignSystem: async () => false })
    const prompt = await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ designSystem: 'skip' }))
    expect(prompt?.appendix).toContain(prototypeRequestMarkerLine(REQUEST))
    expect(prompt?.appendix).not.toContain(designSystemRequestInstruction())
  })

  it('reads whether the directory the child launched in has a design system', async () => {
    const hasDesignSystem = vi.fn(async () => true)
    const { deps } = fakeDeps({ hasDesignSystem })
    await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(hasDesignSystem).toHaveBeenCalledWith('/repo')
  })

  it('keeps the hidden instruction out of the body, so a title read from it never sees it', async () => {
    const { deps } = fakeDeps()
    const prompt = await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(prompt?.body).not.toContain(prototypeRequestMarkerLine(REQUEST))
    expect(prompt?.body).not.toContain(designSystemRequestInstruction())
  })

  it('drops a MassOrca command word from the body the agent works from', async () => {
    const { deps } = fakeDeps()
    const prompt = await delegatedChildFirstPrompt(
      promptInput('/prototype haz una pantalla de login'),
      deps
    )
    expect(prompt?.body).toBe('haz una pantalla de login')
  })

  it('reads a keyword match as a prototype request too', async () => {
    const { deps, createRequest } = fakeDeps()
    await delegatedChildFirstPrompt(promptInput('Diseña la pantalla de ajustes'), deps)
    expect(createRequest).toHaveBeenCalledTimes(1)
  })

  it('asks with the default count in Ask mode, and with the default for an unreadable setting', async () => {
    const ask = fakeDeps({ readPrototypeCount: () => ({ mode: 'ask', count: 2 }) })
    await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), ask.deps)
    expect(ask.createRequest.mock.calls[0]?.[0].count).toBe(2)

    const unreadable = fakeDeps({ readPrototypeCount: () => 'garbage' })
    await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), unreadable.deps)
    expect(unreadable.createRequest.mock.calls[0]?.[0].count).toBe(2)
  })

  it('gives a child this host does not hold its task unchanged, with no request', async () => {
    const { deps, createRequest } = fakeDeps({ readChat: async () => null })
    expect(await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('gives the task unchanged when the request is refused, and leaves no folder to remove', async () => {
    const { deps, removeFolder } = fakeDeps({
      createRequest: async () => ({ ok: false as const, error: 'unwritable' })
    })
    expect(await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)).toBeNull()
    expect(removeFolder).not.toHaveBeenCalled()
  })

  it('gives the task unchanged when making the request throws', async () => {
    const { deps } = fakeDeps({
      createRequest: async () => {
        throw new Error('disk full')
      }
    })
    expect(await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)).toBeNull()
  })

  it('removes the request folder when the instruction cannot be built after all', async () => {
    const { deps, removeFolder } = fakeDeps({
      createRequest: async () => ({ ok: true as const, requestId: 'bad id', folderPath: FOLDER })
    })
    expect(await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)).toBeNull()
    expect(removeFolder).toHaveBeenCalledWith(FOLDER)
  })

  it('removes the request folder when the caller discards an undelivered prompt', async () => {
    const { deps, removeFolder } = fakeDeps()
    const prompt = await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    await prompt?.discard()
    expect(removeFolder).toHaveBeenCalledWith(FOLDER)
  })

  it('makes a Gentle Shell child request as gentle-shell, in the directory the child launched in', async () => {
    const { deps, createRequest } = fakeDeps({
      readChat: async () => ({
        agent: 'pi',
        launchDirectory: '/repo/launch',
        workspaceId: 'workspace-1',
        piRuntime: 'gentle-shell'
      })
    })
    await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'gentle-shell', launchDirectory: '/repo/launch' })
    )
  })

  it('asks as other for a plain Pi child, whose workspace runs stock Pi', async () => {
    const { deps, createRequest } = fakeDeps({
      readChat: async () => ({
        agent: 'pi',
        launchDirectory: '/repo',
        workspaceId: 'workspace-1',
        piRuntime: 'pi'
      })
    })
    await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)
    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ agent: 'other' }))
  })

  it('gives a task longer than a composer would send no request', async () => {
    const { deps, createRequest } = fakeDeps()
    const long = `${NEXUS_TASK} ${'x'.repeat(PROTOTYPE_PROMPT_MAX_LENGTH)}`
    expect(await delegatedChildFirstPrompt(promptInput(long), deps)).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
  })
})

describe('prototypeAgentOfChild', () => {
  it('keeps the prototype agents and names every other agent other', () => {
    expect(prototypeAgentOfChild('claude')).toBe('claude')
    expect(prototypeAgentOfChild('codex')).toBe('codex')
    expect(prototypeAgentOfChild('gentle-shell')).toBe('gentle-shell')
    expect(prototypeAgentOfChild('pi')).toBe('other')
    expect(prototypeAgentOfChild('')).toBe('other')
  })

  it('names a Pi child gentle-shell only when its Pi runtime is Gentle Shell', () => {
    expect(prototypeAgentOfChild('pi', 'gentle-shell')).toBe('gentle-shell')
    expect(prototypeAgentOfChild('pi', 'pi')).toBe('other')
  })
})

describe('a read that throws', () => {
  it('gives the task unchanged, with no request, when the chat record cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { deps, createRequest } = fakeDeps({
      readChat: () => {
        throw new Error('record unreadable')
      }
    })
    expect(await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('gives the task unchanged, with no request, when the Settings count cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { deps, createRequest } = fakeDeps({
      readPrototypeCount: () => {
        throw new Error('settings unreadable')
      }
    })
    expect(await delegatedChildFirstPrompt(promptInput(NEXUS_TASK), deps)).toBeNull()
    expect(createRequest).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
