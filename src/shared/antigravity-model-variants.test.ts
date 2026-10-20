import { describe, expect, it } from 'vitest'
import { parseAntigravityModels } from './commit-message-model-parsers'
import {
  antigravityModelIdAtEffort,
  antigravitySelectionForPicker,
  groupAntigravityModelVariants,
  splitAntigravityModelId
} from './antigravity-model-variants'

// What `agy models` printed on the preview host.
const AGY_LISTING = [
  'gemini-4-argon-medium\tGemini 4 Argon (Medium)',
  'gemini-4-argon-high\tGemini 4 Argon (High)',
  'gemini-4-argon-low\tGemini 4 Argon (Low)',
  'claude-sonnet-5-5-low\tClaude Sonnet 5.5 (Low)',
  'claude-sonnet-5-5-medium\tClaude Sonnet 5.5 (Medium)',
  'gpt-oss-120b-medium\tGPT-OSS 120B (Medium)'
].join('\n')

const rows = () => groupAntigravityModelVariants(parseAntigravityModels(AGY_LISTING))

describe('groupAntigravityModelVariants', () => {
  it('lists each base model once with the efforts agy lists for it', () => {
    expect(rows().map((row) => [row.label, row.efforts.map((effort) => effort.value)])).toEqual([
      ['Gemini 4 Argon', ['low', 'medium', 'high']],
      ['Claude Sonnet 5.5', ['low', 'medium']],
      ['GPT-OSS 120B', ['medium']]
    ])
  })

  it('names each row by its default-effort variant so the id is still a valid agy id', () => {
    expect(rows().map((row) => [row.id, row.defaultEffort])).toEqual([
      ['gemini-4-argon-medium', 'medium'],
      ['claude-sonnet-5-5-medium', 'medium'],
      ['gpt-oss-120b-medium', 'medium']
    ])
  })

  it('falls back to the first listed effort when medium is not listed', () => {
    const [row] = groupAntigravityModelVariants([
      { id: 'm-high', label: 'M (High)' },
      { id: 'm-low', label: 'M (Low)' }
    ])
    expect([row?.id, row?.defaultEffort]).toEqual(['m-low', 'low'])
  })

  it('is stable on rows it grouped already and on a catalog saved before grouping', () => {
    expect(groupAntigravityModelVariants(rows())).toEqual(rows())
    const flat = parseAntigravityModels(AGY_LISTING).map((model) => ({
      ...model,
      isDefault: false,
      efforts: ['low', 'medium', 'high'].map((value) => ({ value, label: value }))
    }))
    expect(groupAntigravityModelVariants(flat)).toEqual(rows())
  })

  it('drops the unlisted current-model row once its model is grouped', () => {
    const withUnlisted = [
      ...rows(),
      { id: 'gemini-4-argon-high', label: 'gemini-4-argon-high', isDefault: false, efforts: [] }
    ]
    expect(groupAntigravityModelVariants(withUnlisted)).toEqual(rows())
  })

  it('keeps a model with no effort variant as listed', () => {
    const [row] = groupAntigravityModelVariants([{ id: 'plain-model', label: 'Plain' }])
    expect([row?.id, row?.label, row?.efforts.length]).toEqual(['plain-model', 'Plain', 3])
  })
})

describe('Antigravity model and effort mapping', () => {
  it('splits an agy id into model and effort', () => {
    expect(splitAntigravityModelId('gemini-3.8-flash-high')).toEqual({
      base: 'gemini-3.8-flash',
      effort: 'high'
    })
    expect(splitAntigravityModelId('plain')).toEqual({ base: 'plain' })
  })

  it('composes the agy id for the picked effort, leaving other ids alone', () => {
    expect(antigravityModelIdAtEffort('gemini-4-argon-medium', 'high')).toBe('gemini-4-argon-high')
    expect(antigravityModelIdAtEffort('gemini-4-argon-medium', undefined)).toBe(
      'gemini-4-argon-medium'
    )
    expect(antigravityModelIdAtEffort('plain', 'high')).toBe('plain')
  })

  it('shows a stored variant id as its model row with the effort it named', () => {
    expect(antigravitySelectionForPicker('gemini-4-argon-high', undefined, rows())).toEqual({
      model: 'gemini-4-argon-medium',
      effort: 'high'
    })
  })

  it('lets a picked effort beat the one in a stored id', () => {
    expect(antigravitySelectionForPicker('gemini-4-argon-medium', 'low', rows())).toEqual({
      model: 'gemini-4-argon-medium',
      effort: 'low'
    })
  })

  it('reads an effort the model does not take as that model default', () => {
    expect(antigravitySelectionForPicker('gpt-oss-120b-medium', 'high', rows())).toEqual({
      model: 'gpt-oss-120b-medium',
      effort: 'medium'
    })
  })
})
