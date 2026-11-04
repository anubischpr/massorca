import { describe, expect, it, vi } from 'vitest'
import { parseEngramImportCounts, parseEngramVersionOutput } from './engram-ops-output'
import {
  createEngramOpsService,
  ENGRAM_IMPORT_MAX_BYTES,
  type EngramOpsDeps
} from './engram-ops-service'

function deps(overrides: Partial<EngramOpsDeps> = {}): EngramOpsDeps {
  return {
    resolveProgram: async () => 'C:\\engram\\engram.exe',
    run: vi.fn(async () => ({ code: 0, output: 'engram 3.3.2\n' })),
    pickFile: async () => 'C:\\tmp\\export.json',
    fileSize: async () => 1024,
    ...overrides
  }
}

describe('version output', () => {
  it('reads a plain version', () => {
    expect(parseEngramVersionOutput('engram 3.3.2\n')).toEqual({ current: '3.3.2', latest: null })
  })

  it('reads the update notice', () => {
    expect(
      parseEngramVersionOutput('engram 3.3.2\nUpdate available: 3.3.2 -> 3.6.1\nTo update:\n')
    ).toEqual({ current: '3.3.2', latest: '3.6.1' })
    expect(parseEngramVersionOutput('Update available 3.3.2 -> 3.6.0')).toEqual({
      current: '3.3.2',
      latest: '3.6.0'
    })
  })

  it('reads import counts and nothing else', () => {
    expect(parseEngramImportCounts('Imported 12 observations, 3 sessions, 0 prompts')).toEqual({
      observations: 12,
      sessions: 3,
      prompts: 0
    })
    expect(parseEngramImportCounts('done')).toEqual({})
  })
})

describe('Engram ops service', () => {
  it('reports no program when Engram is not found', async () => {
    const service = createEngramOpsService(deps({ resolveProgram: async () => null }))
    expect(await service.getProgram()).toEqual({
      found: false,
      current: null,
      latest: null,
      updateAvailable: false
    })
  })

  it('reports the version and a newer release', async () => {
    const run = vi.fn(async () => ({
      code: 0,
      output: 'engram 3.3.2\nUpdate available: 3.3.2 -> 3.6.1'
    }))
    const info = await createEngramOpsService(deps({ run })).getProgram()
    expect(info).toEqual({ found: true, current: '3.3.2', latest: '3.6.1', updateAvailable: true })
    expect(run).toHaveBeenCalledWith('C:\\engram\\engram.exe', ['version'], expect.any(Number))
  })

  it('degrades to an unknown version when the program fails to run', async () => {
    const run = vi.fn(async () => {
      throw new Error('spawn failed')
    })
    expect(await createEngramOpsService(deps({ run })).getProgram()).toEqual({
      found: true,
      current: null,
      latest: null,
      updateAvailable: false
    })
  })

  it('answers Update now with manual advice from the CLI and runs nothing else', async () => {
    const run = vi.fn(async () => ({
      code: 0,
      output:
        'Update available: 3.3.2 -> 3.6.1\nTo update:\n  go install github.com/x/engram/cmd/engram@latest\n  or: https://example.test'
    }))
    const result = await createEngramOpsService(deps({ run })).updateNow()
    expect(result).toMatchObject({ ok: false, reason: 'manual' })
    expect(result.ok === false && result.instruction).toContain(
      'go install github.com/x/engram/cmd/engram@latest'
    )
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('falls back to the releases page without advice', async () => {
    const run = vi.fn(async () => ({ code: 0, output: 'engram 3.3.2' }))
    const result = await createEngramOpsService(deps({ run })).updateNow()
    expect(result).toMatchObject({ ok: false, reason: 'manual' })
    expect(result.ok === false && result.url).toContain('releases')
  })

  it('imports a picked .json file with an argument list', async () => {
    const run = vi.fn(async () => ({ code: 0, output: 'Imported 5 observations' }))
    const result = await createEngramOpsService(deps({ run })).importMemories()
    expect(result).toEqual({ ok: true, counts: { observations: 5 } })
    expect(run).toHaveBeenCalledWith(
      'C:\\engram\\engram.exe',
      ['import', 'C:\\tmp\\export.json'],
      expect.any(Number)
    )
  })

  it('does nothing when the picker is canceled', async () => {
    const run = vi.fn()
    const result = await createEngramOpsService(
      deps({ run, pickFile: async () => null })
    ).importMemories()
    expect(result).toEqual({ ok: false, reason: 'canceled' })
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['a non-json file', { pickFile: async () => 'C:\\tmp\\notes.txt' }, 'not-json'],
    ['a file over the limit', { fileSize: async () => ENGRAM_IMPORT_MAX_BYTES + 1 }, 'too-large'],
    ['an unreadable file', { fileSize: async () => null }, 'unreadable'],
    ['Engram missing', { resolveProgram: async () => null }, 'not-installed']
  ])('refuses %s before running anything', async (_name, override, reason) => {
    const run = vi.fn()
    const result = await createEngramOpsService(deps({ run, ...override })).importMemories()
    expect(result).toEqual({ ok: false, reason })
    expect(run).not.toHaveBeenCalled()
  })

  it('reports a failed import without the program output', async () => {
    const run = vi.fn(async () => ({ code: 1, output: 'secret memory text' }))
    const result = await createEngramOpsService(deps({ run })).importMemories()
    expect(result).toEqual({ ok: false, reason: 'failed' })
  })
})
