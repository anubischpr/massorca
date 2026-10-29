import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BASE_REF_VALUE,
  baseRefChipLabel,
  buildBaseRefChoices
} from './create-session-base-ref'

const refs = [
  { refName: 'main', localBranchName: 'main' },
  { refName: 'origin/main', localBranchName: 'main' },
  { refName: 'origin/release', localBranchName: 'release' },
  { refName: 'feature/login', localBranchName: 'feature/login' }
]

describe('baseRefChipLabel', () => {
  it('shows the pick, else the repo default, else a plain word', () => {
    expect(baseRefChipLabel('origin/release', 'main')).toBe('origin/release')
    expect(baseRefChipLabel(null, 'main')).toBe('main')
    expect(baseRefChipLabel(null, null)).toBe('Default branch')
  })
})

describe('buildBaseRefChoices', () => {
  it('leads with the repo default and marks local and remote branches', () => {
    const choices = buildBaseRefChoices({ refs, query: '', defaultRef: 'origin/main' })
    expect(choices[0]).toMatchObject({ value: DEFAULT_BASE_REF_VALUE, label: 'origin/main' })
    expect(choices.map((choice) => choice.value)).not.toContain('origin/main')
    expect(choices.find((choice) => choice.value === 'origin/release')?.description).toBe(
      'Remote branch'
    )
    expect(choices.find((choice) => choice.value === 'feature/login')?.description).toBe(
      'Local branch'
    )
  })

  it('lists only matches while searching, flagging the default among them', () => {
    const choices = buildBaseRefChoices({
      refs: refs.slice(0, 2),
      query: 'main',
      defaultRef: 'origin/main'
    })
    expect(choices.map((choice) => choice.value)).toEqual(['main', 'origin/main'])
    expect(choices[1]?.description).toBe('Default base branch')
  })

  it('still offers the default row while the default is unknown', () => {
    expect(buildBaseRefChoices({ refs: [], query: '', defaultRef: null })[0]).toMatchObject({
      label: 'Default branch'
    })
  })
})
