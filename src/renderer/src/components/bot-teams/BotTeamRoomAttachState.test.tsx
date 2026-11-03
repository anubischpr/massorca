/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const calls = vi.hoisted(() => ({
  ensure: vi.fn(),
  attach: vi.fn(),
  supported: vi.fn(),
  picked: [] as string[]
}))

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/runtime/bot-team-host', () => ({ useBotTeamHost: () => 'local' }))
vi.mock('@/runtime/runtime-bot-team-client', () => ({
  botTeamFolderWorkspaceId: vi.fn(async () => null),
  ensureBotTeamFolderWorkspace: calls.ensure
}))
vi.mock('./bot-team-room-attach-upload', () => ({
  attachBotTeamRoomFiles: calls.attach,
  botTeamFolderPathOnHost: () => null,
  botTeamRoomAttachmentsSupported: calls.supported
}))

const { useBotTeamRoomAttachments } = await import('./bot-team-room-attach-state')

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
  calls.picked = []
})

/** Renders the hook and hands back its current action, so a test can press it. */
async function mountHook(teamId = 't1') {
  let action: (() => Promise<unknown[]>) | undefined
  function Probe(): null {
    action = useBotTeamRoomAttachments({ teamId })
    return null
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<Probe />))
  await act(async () => {})
  return { action: () => action }
}

describe('the room attach action', () => {
  it('is offered on a host that takes files, before the team folder exists', async () => {
    calls.supported.mockResolvedValue(true)
    const { action } = await mountHook()

    expect(action()).toBeTypeOf('function')
    expect(calls.ensure).not.toHaveBeenCalled()
  })

  it('creates the team folder on the first pick, then copies the picked files into it', async () => {
    calls.supported.mockResolvedValue(true)
    calls.ensure.mockResolvedValue({ workspaceId: 'folder:9', folderPath: '/teams/t1' })
    calls.attach.mockResolvedValue({
      attachments: [{ path: 'attachments/a.png', name: 'a.png' }],
      failed: []
    })
    window.api = {
      shell: { pickAttachments: vi.fn(async () => ['/Users/me/a.png']) }
    } as unknown as typeof window.api
    const { action } = await mountHook('t1')

    const added = await action()!()

    expect(calls.ensure).toHaveBeenCalledWith('t1')
    expect(calls.attach).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'folder:9', folderPath: '/teams/t1' })
    )
    expect(calls.ensure.mock.invocationCallOrder[0]).toBeLessThan(
      calls.attach.mock.invocationCallOrder[0]
    )
    expect(added).toEqual([{ path: 'attachments/a.png', name: 'a.png' }])
  })

  it('creates nothing when the person cancels the pick', async () => {
    calls.supported.mockResolvedValue(true)
    window.api = {
      shell: { pickAttachments: vi.fn(async () => []) }
    } as unknown as typeof window.api
    const { action } = await mountHook()

    expect(await action()!()).toEqual([])
    expect(calls.ensure).not.toHaveBeenCalled()
  })

  it('is not offered on a server that does not take files', async () => {
    calls.supported.mockResolvedValue(false)
    const { action } = await mountHook()

    expect(action()).toBeUndefined()
  })
})
