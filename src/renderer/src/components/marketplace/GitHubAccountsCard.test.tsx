// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'

type TestRepo = { displayName: string; ghAccount?: { host: string; user: string } }

const mocks = vi.hoisted(() => {
  const repos: TestRepo[] = []
  return {
    listHostBindableAccounts: vi.fn(),
    switchActiveAccount: vi.fn(),
    removeAccount: vi.fn(),
    repos
  }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { repos: typeof mocks.repos }) => unknown) =>
    selector({ repos: mocks.repos })
}))

const { GitHubAccountsCard } = await import('./GitHubAccountsCard')
const { useGitHubAccounts } = await import('./use-github-accounts')

function Harness(): React.JSX.Element {
  const accounts = useGitHubAccounts(true)
  return <GitHubAccountsCard accounts={accounts} />
}

const roots: Root[] = []

function account(user: string, overrides: Partial<GhAuthAccount> = {}): GhAuthAccount {
  return {
    host: 'github.com',
    user,
    active: false,
    envToken: null,
    source: 'keyring',
    scopes: ['repo'],
    ...overrides
  }
}

async function renderCard(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<Harness />)
  })
  return container
}

function buttonByText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
}

function submitDialog(): void {
  document
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('GitHubAccountsCard', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.repos = [
      { displayName: 'massorca', ghAccount: { host: 'github.com', user: 'work' } },
      { displayName: 'notes' }
    ]
    mocks.listHostBindableAccounts.mockResolvedValue({
      capability: 'supported',
      accounts: [account('personal', { active: true }), account('work')]
    })
    mocks.switchActiveAccount.mockResolvedValue({ ok: true })
    mocks.removeAccount.mockResolvedValue({ ok: true })
    Object.assign(window, {
      api: {
        gh: {
          listHostBindableAccounts: mocks.listHostBindableAccounts,
          switchActiveAccount: mocks.switchActiveAccount,
          removeAccount: mocks.removeAccount
        },
        ui: { writeClipboardText: vi.fn() }
      }
    })
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('lists every account, marks the active one and shows the projects each one serves', async () => {
    const container = await renderCard()
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent ?? '')
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('personal')
    expect(items[0]).toContain('Active')
    expect(items[1]).toContain('work')
    expect(items[1]).not.toContain('Active')
    expect(items[1]).toContain('massorca')
    expect(container.textContent).toContain('These projects use the active account: notes')
  })

  it('offers Make active only on inactive keyring accounts and reloads after switching', async () => {
    const container = await renderCard()
    const makeActive = [...container.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes('Make active')
    )
    expect(makeActive).toHaveLength(1)
    await act(async () => {
      makeActive[0].click()
    })
    expect(mocks.switchActiveAccount).toHaveBeenCalledWith({ host: 'github.com', user: 'work' })
    expect(mocks.listHostBindableAccounts).toHaveBeenCalledTimes(2)
  })

  it('explains a failed switch without showing gh output', async () => {
    mocks.switchActiveAccount.mockResolvedValue({ ok: false, reason: 'unsupported' })
    const container = await renderCard()
    await act(async () => {
      buttonByText(container, 'Make active')?.click()
    })
    expect(container.textContent).toContain('Update the GitHub CLI to switch accounts from here.')
  })

  it('does not offer switching for an environment token account or an old GitHub CLI', async () => {
    mocks.listHostBindableAccounts.mockResolvedValue({
      capability: 'unsupported',
      accounts: [
        account('personal', { active: true }),
        account('ci', { source: 'env', envToken: 'GH_TOKEN' })
      ]
    })
    const container = await renderCard()
    expect(buttonByText(container, 'Make active')).toBeUndefined()
    expect(container.textContent).toContain('Comes from GH_TOKEN')
    expect(container.textContent).toContain('Update it to 2.40 or newer')
  })

  it('offers Remove on every keyring account, and removes an inactive one after a confirmation', async () => {
    mocks.listHostBindableAccounts.mockResolvedValue({
      capability: 'supported',
      accounts: [
        account('personal', { active: true }),
        account('work'),
        account('side'),
        account('ci', { source: 'env', envToken: 'GH_TOKEN' })
      ]
    })
    const container = await renderCard()
    const removeButtons = [...container.querySelectorAll<HTMLButtonElement>('li button')].filter(
      (button) => button.textContent?.trim() === 'Remove'
    )
    expect(removeButtons).toHaveLength(3)
    const rowOfCi = [...container.querySelectorAll('li')].find((li) =>
      li.textContent?.includes('ci')
    )
    expect(rowOfCi?.textContent).not.toContain('Remove')
    await act(async () => {
      removeButtons[2]?.click()
    })
    expect(mocks.removeAccount).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Remove side from this computer?')
    await act(async () => {
      submitDialog()
    })
    expect(mocks.removeAccount).toHaveBeenCalledWith({ host: 'github.com', user: 'side' })
    expect(mocks.listHostBindableAccounts).toHaveBeenCalledTimes(2)
  })

  it('removes the active account after a confirmation', async () => {
    const container = await renderCard()
    const firstRow = container.querySelector('li')
    await act(async () => {
      buttonByText(firstRow ?? container, 'Remove')?.click()
    })
    expect(document.body.textContent).toContain('Remove personal from this computer?')
    await act(async () => {
      submitDialog()
    })
    expect(mocks.removeAccount).toHaveBeenCalledWith({ host: 'github.com', user: 'personal' })
  })

  it('keeps the account when the removal is cancelled', async () => {
    const container = await renderCard()
    await act(async () => {
      buttonByText(container, 'Remove')?.click()
    })
    await act(async () => {
      buttonByText(document.body, 'Cancel')?.click()
    })
    expect(mocks.removeAccount).not.toHaveBeenCalled()
  })

  it('explains a failed removal without showing gh output', async () => {
    mocks.removeAccount.mockResolvedValue({ ok: false, reason: 'failed' })
    const container = await renderCard()
    await act(async () => {
      buttonByText(container, 'Remove')?.click()
    })
    await act(async () => {
      submitDialog()
    })
    expect(document.body.textContent).toContain('Could not remove personal.')
  })

  it('flags a project bound to a login that is not signed in here', async () => {
    mocks.repos = [{ displayName: 'client', ghAccount: { host: 'github.com', user: 'gone' } }]
    const container = await renderCard()
    expect(container.textContent).toContain(
      'client is set to gone on github.com, which is not signed in here.'
    )
  })
})
