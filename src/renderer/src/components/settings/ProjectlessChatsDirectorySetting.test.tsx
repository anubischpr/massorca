// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { ProjectlessChatsDirectorySetting } from './ProjectlessChatsDirectorySetting'

const STOCK_DIR = '/home/alice/orca/chats'

let container: HTMLDivElement
let root: Root
let pickFolderMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  pickFolderMock = vi.fn()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      repos: { pickFolder: pickFolderMock },
      settings: { getDefaultProjectlessChatsDir: vi.fn().mockResolvedValue(STOCK_DIR) }
    }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  Reflect.deleteProperty(window, 'api')
})

async function renderSetting(args: {
  projectlessChatsDir?: string
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): Promise<void> {
  const settings = {
    ...getDefaultSettings('/home/alice'),
    projectlessChatsDir: args.projectlessChatsDir ?? STOCK_DIR
  }
  await act(async () => {
    root.render(
      <ProjectlessChatsDirectorySetting settings={settings} updateSettings={args.updateSettings} />
    )
  })
}

function getInput(): HTMLInputElement {
  const input = container.querySelector('input')
  if (!input) {
    throw new Error('projectless chats folder input was not rendered')
  }
  return input
}

function getButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (entry) => entry.textContent?.trim() === label
  )
  if (!button) {
    throw new Error(`${label} button was not rendered`)
  }
  return button
}

function typePath(path: string): void {
  act(() => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setValue?.call(getInput(), path)
    getInput().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function blurInput(): void {
  act(() => {
    getInput().dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

function pressInputKey(key: string): void {
  act(() => {
    getInput().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('ProjectlessChatsDirectorySetting', () => {
  it('shows the current folder and keeps typed paths local until blur', async () => {
    const updateSettings = vi.fn()
    await renderSetting({ projectlessChatsDir: '/work/chats', updateSettings })

    expect(getInput().value).toBe('/work/chats')
    typePath('/work/chats-2')
    expect(updateSettings).not.toHaveBeenCalled()

    blurInput()

    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(updateSettings).toHaveBeenCalledWith({ projectlessChatsDir: '/work/chats-2' })
  })

  it('commits Enter once even though Enter also blurs the input', async () => {
    const updateSettings = vi.fn()
    await renderSetting({ updateSettings })

    typePath('/work/chats')
    pressInputKey('Enter')
    blurInput()

    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(updateSettings).toHaveBeenCalledWith({ projectlessChatsDir: '/work/chats' })
  })

  it('reverts a blank draft without saving', async () => {
    const updateSettings = vi.fn()
    await renderSetting({ updateSettings })

    typePath('   ')
    blurInput()

    expect(getInput().value).toBe(STOCK_DIR)
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('discards the draft on Escape without saving', async () => {
    const updateSettings = vi.fn()
    await renderSetting({ updateSettings })

    typePath('/work/chats')
    pressInputKey('Escape')
    blurInput()

    expect(getInput().value).toBe(STOCK_DIR)
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('disables Reset while the folder is the stock folder', async () => {
    await renderSetting({ updateSettings: vi.fn() })

    await act(async () => {})

    expect(getButton('Reset').disabled).toBe(true)
  })

  it('restores the stock folder when Reset is pressed on a custom folder', async () => {
    const updateSettings = vi.fn()
    await renderSetting({ projectlessChatsDir: '/work/chats', updateSettings })
    await act(async () => {})

    expect(getButton('Reset').disabled).toBe(false)
    await act(async () => {
      getButton('Reset').click()
    })

    expect(updateSettings).toHaveBeenCalledWith({ projectlessChatsDir: STOCK_DIR })
  })

  it('saves the folder chosen with Change', async () => {
    const updateSettings = vi.fn()
    pickFolderMock.mockResolvedValue('/Users/alice/Chats')
    await renderSetting({ updateSettings })

    await act(async () => {
      getButton('Change').click()
      await Promise.resolve()
    })

    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(updateSettings).toHaveBeenCalledWith({ projectlessChatsDir: '/Users/alice/Chats' })
  })

  it('keeps the saved folder when Change is canceled', async () => {
    const updateSettings = vi.fn()
    pickFolderMock.mockResolvedValue(null)
    await renderSetting({ projectlessChatsDir: '/work/chats', updateSettings })

    await act(async () => {
      getButton('Change').click()
      await Promise.resolve()
    })

    expect(getInput().value).toBe('/work/chats')
    expect(updateSettings).not.toHaveBeenCalled()
  })
})
