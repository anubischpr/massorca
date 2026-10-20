import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { withAntigravityArtifactMetadata } from './antigravity-artifact-metadata'

// The sidecar agy writes beside a plan mode document, as observed on a real run.
const SIDECAR = {
  summary: 'Plan for the change',
  updatedAt: '2026-10-20T08:29:18.987259676Z',
  requestFeedback: true,
  userFacing: true
}

describe('withAntigravityArtifactMetadata', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agy-artifact-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('adds the sidecar fields beside Path for a write_file artifact', () => {
    const path = join(dir, 'plan.md')
    writeFileSync(`${path}.metadata.json`, JSON.stringify(SIDECAR))
    expect(withAntigravityArtifactMetadata('write_file', { Path: path })).toEqual({
      Path: path,
      antigravityArtifact: {
        userFacing: true,
        requestFeedback: true,
        summary: 'Plan for the change'
      }
    })
  })

  it('leaves a write with no sidecar, another tool and a relative path unchanged', () => {
    const path = join(dir, 'notes.md')
    expect(withAntigravityArtifactMetadata('write_file', { Path: path })).toEqual({ Path: path })
    writeFileSync(`${path}.metadata.json`, JSON.stringify(SIDECAR))
    expect(withAntigravityArtifactMetadata('read_file', { Path: path })).toEqual({ Path: path })
    expect(withAntigravityArtifactMetadata('write_file', { Path: 'notes.md' })).toEqual({
      Path: 'notes.md'
    })
  })

  it('ignores a sidecar that is not agy metadata', () => {
    const path = join(dir, 'plan.md')
    writeFileSync(`${path}.metadata.json`, JSON.stringify({ summary: 42 }))
    expect(withAntigravityArtifactMetadata('edit_file', { Path: path })).toEqual({ Path: path })
    writeFileSync(`${path}.metadata.json`, 'not json')
    expect(withAntigravityArtifactMetadata('edit_file', { Path: path })).toEqual({ Path: path })
  })
})
