// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeThumbnail } from './PrototypeThumbnail'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('./use-prototype-file-html', () => ({
  usePrototypeFileHtml: () => ({ status: 'loading' })
}))

const SET: PrototypeListedSet = {
  requestId: '20261028-201500-aaaaaa',
  sessionId: 'session-alpha-0001',
  agent: 'claude',
  worktreeId: null,
  chatTitle: 'Checkout',
  originalPrompt: 'a checkout page',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 1,
  directions: [
    {
      letter: 'A',
      versions: [{ version: 1, fileName: 'prototypes/20261028-201500-aaaaaa/A.html', mtime: 1 }]
    }
  ]
}

function renderedAspectRatio(viewport?: 'desktop' | 'phone'): string | null {
  const { container } = render(
    <PrototypeThumbnail set={SET} direction={SET.directions[0]} viewport={viewport} />
  )
  return container.firstElementChild?.getAttribute('style') ?? null
}

describe('PrototypeThumbnail', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    )
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })
  afterEach(cleanup)

  it('keeps the desktop page shape by default', () => {
    expect(renderedAspectRatio()).toContain('aspect-ratio: 1440 / 900')
  })

  it('takes the phone frame width and a phone height in phone view', () => {
    expect(renderedAspectRatio('phone')).toContain('aspect-ratio: 390 / 844')
  })
})
