/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const { CreateChatComposer } = await import('./CreateChatComposer')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(copy?: React.ComponentProps<typeof CreateChatComposer>['copy']): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <CreateChatComposer
        draft=""
        onDraftChange={() => {}}
        canSubmit
        pending={false}
        error={null}
        onSubmit={() => {}}
        placeChips={null}
        footerChips={null}
        notice={null}
        rightChips={null}
        copy={copy}
      />
    )
  )
  return container
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('CreateChatComposer copy', () => {
  it('keeps the session wording by default', () => {
    const container = mount()
    expect(container.querySelector('textarea')?.getAttribute('placeholder')).toBe(
      'Describe the task to start the session…'
    )
    expect(container.querySelector('button[aria-label="Create session"]')).not.toBeNull()
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Where it runs'
    )
  })

  it('takes another page’s wording for the box, the send button, the place row and the hint', () => {
    const container = mount({
      placeholder: 'Describe the task for the team…',
      placeAria: 'Where it goes',
      sendAria: 'Create task',
      creatingAria: 'Creating task',
      creating: 'Creating task…',
      hint: 'Enter to create the task · Shift+Enter for a new line'
    })
    expect(container.querySelector('textarea')?.getAttribute('placeholder')).toBe(
      'Describe the task for the team…'
    )
    expect(container.querySelector('button[aria-label="Create task"]')).not.toBeNull()
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Where it goes'
    )
    expect(container.textContent).toContain('Enter to create the task')
  })
})
