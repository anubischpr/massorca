import { describe, expect, it } from 'vitest'
import { designSystemRestoreFailureAlert } from './mobile-prototype-design-system-version-restore'

describe('designSystemRestoreFailureAlert', () => {
  it('shows nothing for a restore that worked', () => {
    expect(designSystemRestoreFailureAlert({ kind: 'restored', version: 5 })).toBeNull()
  })

  it('says what happened for each refusal the host gives', () => {
    expect(designSystemRestoreFailureAlert({ kind: 'refused', error: 'current' })).toEqual({
      title: 'This is already the current version',
      message: 'Nothing was restored.'
    })
    expect(designSystemRestoreFailureAlert({ kind: 'refused', error: 'not_found' })?.title).toBe(
      'Could not restore this version'
    )
    expect(designSystemRestoreFailureAlert({ kind: 'refused', error: 'unwritable' })?.message).toBe(
      'Your computer could not save the restored copy.'
    )
  })

  it('asks for a newer Orca on an older host and retries on a lost connection', () => {
    expect(designSystemRestoreFailureAlert({ kind: 'unsupported-host' })?.title).toBe(
      'Restore needs a newer Orca'
    )
    expect(designSystemRestoreFailureAlert({ kind: 'unreachable' })?.title).toBe(
      'Could not reach your computer'
    )
  })
})
