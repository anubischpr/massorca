// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSetState,
  setPrompt,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeSidePanel } from './PrototypeSidePanel'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

const SET: PrototypeListedSet = {
  requestId: '20261028-201500-aaaaaa',
  sessionId: 'session-alpha-0001',
  agent: 'claude',
  worktreeId: null,
  chatTitle: 'Checkout',
  originalPrompt: 'a checkout page',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 2,
  directions: [
    {
      letter: 'A',
      versions: [{ version: 1, fileName: 'prototypes/20261028-201500-aaaaaa/A.html', mtime: 1 }]
    }
  ]
}

function renderPanel(state: PrototypeSetState): void {
  render(<PrototypeSidePanel set={SET} state={state} update={vi.fn()} onSend={vi.fn()} />)
}

function sendButton(): HTMLElement {
  return screen.getByRole('button', { name: /^Send to/u })
}

describe('PrototypeSidePanel Send', () => {
  afterEach(cleanup)

  it('holds Send while the draft has no change and "Anything else" is empty', () => {
    renderPanel(createSetState(['A']))

    expect(sendButton()).toBeDisabled()
  })

  it('enables Send once "Anything else" has words', () => {
    renderPanel(setPrompt(createSetState(['A']), 'Make it bolder.'))

    expect(sendButton()).toBeEnabled()
  })
})
