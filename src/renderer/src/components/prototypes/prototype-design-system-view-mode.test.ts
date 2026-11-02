// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_COMPONENTS_VIEW,
  readComponentsView,
  writeComponentsView
} from './prototype-design-system-view-mode'

const KEY = 'orca.prototypes.designSystem.componentsView'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('components view preference', () => {
  it('defaults to collage with nothing stored', () => {
    expect(DEFAULT_COMPONENTS_VIEW).toBe('collage')
    expect(readComponentsView()).toBe('collage')
  })

  it('reads back the view that was written, and ignores a stored value it does not know', () => {
    writeComponentsView('list')
    expect(readComponentsView()).toBe('list')
    window.localStorage.setItem(KEY, 'carousel')
    expect(readComponentsView()).toBe('collage')
  })

  it('falls back to the default when the store cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(readComponentsView()).toBe('collage')
    expect(() => writeComponentsView('grid')).not.toThrow()
  })
})
