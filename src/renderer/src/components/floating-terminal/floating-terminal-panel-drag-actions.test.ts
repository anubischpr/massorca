// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PointerEvent } from 'react'
import { createFloatingTerminalPanelDragActions } from './floating-terminal-panel-drag-actions'

function pressOn(titlebar: HTMLDivElement, target: Element): PointerEvent<HTMLDivElement> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: handleDragStart reads only these fields of the React pointer event.
  return {
    button: 0,
    pointerId: 1,
    clientX: 10,
    clientY: 10,
    target,
    currentTarget: titlebar
  } as unknown as PointerEvent<HTMLDivElement>
}

function setup() {
  const titlebar = document.createElement('div')
  titlebar.setPointerCapture = vi.fn()
  document.body.append(titlebar)
  const focusPanelForShortcuts = vi.fn()
  const dragRef = { current: null }
  const actions = createFloatingTerminalPanelDragActions({
    maximized: false,
    dragRef,
    bounds: { left: 0, top: 0, width: 400, height: 300 },
    focusPanelForShortcuts,
    previewUserBounds: vi.fn(),
    commitUserBounds: vi.fn(),
    toggleMaximized: vi.fn()
  })
  return { titlebar, focusPanelForShortcuts, dragRef, actions }
}

describe('floating panel titlebar drag', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('starts a drag on the bare titlebar', () => {
    const { titlebar, focusPanelForShortcuts, actions } = setup()
    actions.handleDragStart(pressOn(titlebar, titlebar))
    expect(focusPanelForShortcuts).toHaveBeenCalledTimes(1)
    expect(titlebar.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('leaves a press in a portaled select list to the list, so its option can be picked', () => {
    const { titlebar, focusPanelForShortcuts, dragRef, actions } = setup()
    const option = document.createElement('div')
    option.setAttribute('role', 'option')
    document.body.append(option)
    actions.handleDragStart(pressOn(titlebar, option))
    expect(focusPanelForShortcuts).not.toHaveBeenCalled()
    expect(titlebar.setPointerCapture).not.toHaveBeenCalled()
    expect(dragRef.current).toBeNull()
  })
})
