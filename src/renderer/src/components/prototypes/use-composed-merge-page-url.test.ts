// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useComposedMergePageUrl } from './use-composed-merge-page-url'

type PageProps = { html: string | null; anchor: string | null }

const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

function renderPage(initial: PageProps) {
  return renderHook(({ html, anchor }: PageProps) => useComposedMergePageUrl(html, anchor), {
    initialProps: initial
  })
}

describe('useComposedMergePageUrl', () => {
  let created = 0

  beforeEach(() => {
    created = 0
    URL.createObjectURL = vi.fn(() => {
      created += 1
      return `blob:page-${created}`
    })
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })

  it('is null until there is a page to show', () => {
    const { result } = renderPage({ html: null, anchor: null })
    expect(result.current).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('moves to an anchor on the same page, with no new page', () => {
    const { result, rerender } = renderPage({ html: '<p>a</p>', anchor: null })
    expect(result.current).toBe('blob:page-1')
    rerender({ html: '<p>a</p>', anchor: 'merge-part-0' })
    expect(result.current).toBe('blob:page-1#merge-part-0')
    rerender({ html: '<p>a</p>', anchor: 'merge-part-1' })
    expect(result.current).toBe('blob:page-1#merge-part-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('makes a new page when the html changes, and releases the old one', () => {
    const { result, rerender } = renderPage({ html: '<p>a</p>', anchor: null })
    rerender({ html: '<p>b</p>', anchor: 'merge-part-1' })
    expect(result.current).toBe('blob:page-2#merge-part-1')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page-1')
  })

  it('releases the page when it unmounts', () => {
    const { result, unmount } = renderPage({ html: '<p>a</p>', anchor: null })
    expect(result.current).toBe('blob:page-1')
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page-1')
  })
})
