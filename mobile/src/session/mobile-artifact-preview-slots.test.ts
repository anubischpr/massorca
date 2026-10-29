import { describe, expect, it, vi } from 'vitest'
import { createArtifactPreviewSlots } from './mobile-artifact-preview-slots'

describe('createArtifactPreviewSlots', () => {
  it('refuses a preview past the cap, and admits one already holding a slot', () => {
    const slots = createArtifactPreviewSlots(2)
    expect(slots.acquire('a')).toBe(true)
    expect(slots.acquire('b')).toBe(true)
    expect(slots.acquire('c')).toBe(false)
    expect(slots.acquire('a')).toBe(true)
    expect(slots.heldCount()).toBe(2)
  })

  it('frees a slot on release and wakes the waiting previews', () => {
    const slots = createArtifactPreviewSlots(1)
    const woken = vi.fn()
    slots.subscribe(woken)
    slots.acquire('a')
    expect(slots.acquire('b')).toBe(false)
    slots.release('a')
    expect(woken).toHaveBeenCalledTimes(1)
    expect(slots.acquire('b')).toBe(true)
  })

  it('does not wake anyone for a release of a preview that held nothing', () => {
    const slots = createArtifactPreviewSlots(1)
    const woken = vi.fn()
    slots.subscribe(woken)
    slots.release('never-held')
    expect(woken).not.toHaveBeenCalled()
  })

  it('stops waking a preview that unsubscribed', () => {
    const slots = createArtifactPreviewSlots(1)
    const woken = vi.fn()
    const unsubscribe = slots.subscribe(woken)
    unsubscribe()
    slots.acquire('a')
    slots.release('a')
    expect(woken).not.toHaveBeenCalled()
  })
})
