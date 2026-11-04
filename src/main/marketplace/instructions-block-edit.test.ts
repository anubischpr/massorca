import { describe, expect, it } from 'vitest'
import {
  hasForeignEngramInstructions,
  hasInstructionsBlock,
  withInstructionsBlock,
  withoutInstructionsBlock
} from './instructions-block-edit'

describe('instructions block', () => {
  it.each([
    ['LF', '# Notes\n\nSome rules.\n'],
    ['CRLF', '# Notes\r\n\r\nSome rules.\r\n'],
    ['no final newline', '# Notes\n\nSome rules.'],
    ['CRLF without final newline', '# Notes\r\n\r\nSome rules.'],
    ['empty', ''],
    ['ending in a blank line', 'Rules\n\n'],
    ['with comments', '<!-- keep me -->\n# Notes\n<!-- and me -->\n']
  ])('adds then removes a block byte for byte (%s)', (_label, original) => {
    for (const id of ['engram', 'openmetadata'] as const) {
      const added = withInstructionsBlock(original, id)
      expect(hasInstructionsBlock(added, id)).toBe(true)
      expect(withoutInstructionsBlock(added, id)).toBe(original)
    }
  })

  it('writes the engram recipe between the markers and is idempotent', () => {
    const added = withInstructionsBlock('# Rules\n', 'engram')
    expect(added).toContain('<!-- massorca:engram:start -->')
    expect(added).toContain('mem_context')
    expect(added).toContain('mem_search')
    expect(added).toContain('mem_get_observation')
    expect(added).toContain('mem_save')
    expect(added).toContain('<!-- massorca:engram:end -->')
    expect(withInstructionsBlock(added, 'engram')).toBe(added)
  })

  it('removes exactly one block and leaves the other one', () => {
    const both = withInstructionsBlock(withInstructionsBlock('# Rules\n', 'engram'), 'openmetadata')
    const onlyOpenMetadata = withoutInstructionsBlock(both, 'engram')
    expect(hasInstructionsBlock(onlyOpenMetadata, 'engram')).toBe(false)
    expect(hasInstructionsBlock(onlyOpenMetadata, 'openmetadata')).toBe(true)
    expect(withoutInstructionsBlock(onlyOpenMetadata, 'openmetadata')).toBe('# Rules\n')
  })

  it('leaves a file without the block alone and ignores an unterminated start marker', () => {
    expect(withoutInstructionsBlock('# Rules\n', 'engram')).toBe('# Rules\n')
    const broken = '# Rules\n<!-- massorca:engram:start -->\nhalf\n'
    expect(withoutInstructionsBlock(broken, 'engram')).toBe(broken)
  })

  it('recognizes an Engram section written by someone else', () => {
    expect(hasForeignEngramInstructions('## Engram Persistent Memory\n\nrules\n')).toBe(true)
    expect(hasForeignEngramInstructions('# Rules\n')).toBe(false)
    expect(hasForeignEngramInstructions(withInstructionsBlock('# Rules\n', 'engram'))).toBe(false)
  })
})
