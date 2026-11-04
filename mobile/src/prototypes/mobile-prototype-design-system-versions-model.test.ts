import { describe, expect, it } from 'vitest'
import {
  designSystemRestoreConfirmOf,
  designSystemRestoreLabelOf,
  designSystemVersionRowsOf,
  latestDesignSystemVersionOf
} from './mobile-prototype-design-system-versions-model'

const NOW = new Date(2026, 10, 4, 15, 0)
const TODAY_1405 = new Date(2026, 10, 4, 14, 5).toISOString()
const TODAY_1120 = new Date(2026, 10, 4, 11, 20).toISOString()

describe('designSystemVersionRowsOf', () => {
  it('lists the current version without a button, a saved earlier one as viewable, and an unsaved one as not saved', () => {
    const rows = designSystemVersionRowsOf(
      [
        { version: 2, saved: false, current: false },
        { version: 3, at: TODAY_1120, saved: true, current: false },
        { version: 4, at: TODAY_1405, saved: true, current: true }
      ],
      NOW
    )
    expect(rows).toEqual([
      { version: 4, label: 'Current · v4', timeLabel: 'Today, 14:05', state: 'current' },
      { version: 3, label: 'v3', timeLabel: 'Today, 11:20', state: 'viewable' },
      { version: 2, label: 'v2', timeLabel: '', state: 'unsaved' }
    ])
  })

  it('shows the date of a version made on another day', () => {
    const rows = designSystemVersionRowsOf(
      [{ version: 1, at: new Date(2026, 9, 28, 21, 5).toISOString(), saved: true, current: true }],
      NOW
    )
    expect(rows[0]?.timeLabel).toBe('Oct 28, 21:05')
  })
})

describe('latestDesignSystemVersionOf', () => {
  it('is the highest version listed, or null when none is listed', () => {
    expect(
      latestDesignSystemVersionOf([
        { version: 2, saved: false, current: false },
        { version: 4, saved: true, current: true }
      ])
    ).toBe(4)
    expect(latestDesignSystemVersionOf([])).toBeNull()
  })
})

describe('designSystemRestoreLabelOf', () => {
  it('names the number the restored copy gets', () => {
    expect(designSystemRestoreLabelOf(4)).toBe('↺ Restore as v5')
  })
})

describe('designSystemRestoreConfirmOf', () => {
  it('asks first with the exact confirm text and keeps the earlier versions listed', () => {
    expect(designSystemRestoreConfirmOf(3, 4)).toEqual({
      title: 'Restore v3 as v5?',
      message:
        'It becomes version 5, the current one, with the content of v3. Versions 1 to 4 stay in the list.'
    })
  })
})
