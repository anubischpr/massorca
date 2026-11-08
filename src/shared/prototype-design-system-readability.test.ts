import { describe, expect, it } from 'vitest'
import type { ReadPrototypeDesignSystemResult } from './rpc-contract/prototype-params'
import { checkDesignSystemReadability } from './prototype-design-system-readability'

const FOLDER = '/work/oppm/design/system'
const TOKENS = 'design/system/tokens.json'
const COMPONENTS = 'design/system/components.html'
const SOURCE = 'design/system/system.md'

const VALID_TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  $extensions: { massorca: { version: 3, status: 'proposed' } }
})

function readOk(
  fields: Partial<Extract<ReadPrototypeDesignSystemResult, { ok: true }>> = {}
): ReadPrototypeDesignSystemResult {
  return { ok: true, projectKey: 'oppm', projectName: 'oppm', fileNames: [], ...fields }
}

describe('checkDesignSystemReadability', () => {
  it('reads a valid system and reports its folder and version', () => {
    const verdict = checkDesignSystemReadability(
      readOk({
        fileNames: [TOKENS, COMPONENTS, SOURCE],
        tokensJson: VALID_TOKENS,
        componentsHtml: '<main></main>',
        systemMd: '# System',
        folderPath: FOLDER
      })
    )

    expect(verdict).toEqual({
      readable: true,
      folderPath: FOLDER,
      version: 3,
      filesRead: [TOKENS, COMPONENTS, SOURCE],
      missing: [],
      unreadable: [],
      otherFiles: [],
      reasons: []
    })
  })

  it('treats a missing components.html or system.md as a warning, not a blocker', () => {
    const verdict = checkDesignSystemReadability(
      readOk({ fileNames: [TOKENS], tokensJson: VALID_TOKENS, folderPath: FOLDER })
    )

    expect(verdict.readable).toBe(true)
    expect(verdict.missing).toEqual([COMPONENTS, SOURCE])
    expect(verdict.reasons).toEqual([
      `${COMPONENTS} is missing (warning, not blocking).`,
      `${SOURCE} is missing (warning, not blocking).`
    ])
  })

  it('explains an oppm-style system written under other file names', () => {
    const verdict = checkDesignSystemReadability(
      readOk({
        folderPath: FOLDER,
        otherFileNames: [
          'design/system/tokens.css',
          'design/system/README.md',
          'design/system/preview.html'
        ]
      })
    )

    expect(verdict.readable).toBe(false)
    expect(verdict.version).toBeUndefined()
    expect(verdict.filesRead).toEqual([])
    expect(verdict.missing).toEqual([TOKENS, COMPONENTS, SOURCE])
    expect(verdict.otherFiles).toEqual([
      'design/system/tokens.css',
      'design/system/README.md',
      'design/system/preview.html'
    ])
    expect(verdict.reasons).toEqual([
      `${TOKENS} is missing; MassOrca reads the design system from it.`,
      `${COMPONENTS} is missing (warning, not blocking).`,
      `${SOURCE} is missing (warning, not blocking).`,
      'design/system holds tokens.css, README.md, preview.html, which MassOrca does not read; it reads tokens.json, components.html and system.md'
    ])
  })

  it('reports a tokens.json that is present but is not a design system', () => {
    const verdict = checkDesignSystemReadability(
      readOk({ fileNames: [TOKENS], tokensJson: '{ not json', folderPath: FOLDER })
    )

    expect(verdict.readable).toBe(false)
    expect(verdict.version).toBeUndefined()
    expect(verdict.filesRead).toEqual([TOKENS])
    expect(verdict.missing).toEqual([COMPONENTS, SOURCE])
    expect(verdict.reasons[0]).toBe(
      `${TOKENS} is present but is not a valid design system; it must be a JSON object.`
    )
    expect(verdict.reasons).not.toContainEqual(expect.stringContaining('is missing; MassOrca'))
  })

  it('says a chat not found on this host is not readable and names no files', () => {
    expect(checkDesignSystemReadability({ ok: false, error: 'not_found' })).toEqual({
      readable: false,
      filesRead: [],
      missing: [],
      unreadable: [],
      otherFiles: [],
      reasons: ['The chat was not found on this host, or it is not a local chat.']
    })
  })

  it('does not call a tokens.json that exists but cannot be read missing', () => {
    const verdict = checkDesignSystemReadability(
      readOk({ unreadableFileNames: [TOKENS], folderPath: FOLDER })
    )

    expect(verdict.readable).toBe(false)
    expect(verdict.unreadable).toEqual([TOKENS])
    expect(verdict.missing).toEqual([COMPONENTS, SOURCE])
    expect(verdict.reasons).toEqual([
      `${TOKENS} is present but could not be read (over the size limit, not text, or a path MassOrca does not follow).`,
      `${COMPONENTS} is missing (warning, not blocking).`,
      `${SOURCE} is missing (warning, not blocking).`
    ])
  })

  it('reads an older host that omits folderPath and otherFileNames', () => {
    const verdict = checkDesignSystemReadability(
      readOk({ fileNames: [TOKENS], tokensJson: VALID_TOKENS })
    )

    expect(verdict.readable).toBe(true)
    expect(verdict.folderPath).toBeUndefined()
    expect(verdict.version).toBe(3)
    expect(verdict.otherFiles).toEqual([])
    expect(verdict.reasons).toEqual([
      `${COMPONENTS} is missing (warning, not blocking).`,
      `${SOURCE} is missing (warning, not blocking).`
    ])
  })

  it('orders blocking reasons first, then warnings, then the other files', () => {
    const verdict = checkDesignSystemReadability(
      readOk({
        fileNames: [TOKENS],
        tokensJson: VALID_TOKENS,
        unreadableFileNames: [COMPONENTS],
        otherFileNames: ['design/system/README.md']
      })
    )

    expect(verdict.readable).toBe(true)
    expect(verdict.reasons).toEqual([
      `${COMPONENTS} is present but could not be read (over the size limit, not text, or a path MassOrca does not follow).`,
      `${SOURCE} is missing (warning, not blocking).`,
      'design/system holds README.md, which MassOrca does not read; it reads tokens.json, components.html and system.md'
    ])
  })
})
