// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { useBotTeamIdsKey, useBotTeams, type BotTeamsState } from './use-bot-teams'

const listBotTeams = vi.hoisted(() => vi.fn())
const host = vi.hoisted(() => ({ current: 'local' }))
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeams }))
vi.mock('@/runtime/bot-team-host', () => ({ useBotTeamHost: () => host.current }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const team = (id: string): BotTeam => ({ id, name: id }) as unknown as BotTeam
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const seen: { page: BotTeamsState | null; sidebar: BotTeamsState | null; key: string } = {
  page: null,
  sidebar: null,
  key: ''
}
function Page(): null {
  seen.page = useBotTeams()
  return null
}
function Sidebar(): null {
  seen.sidebar = useBotTeams()
  return null
}
function Reader(): null {
  seen.key = useBotTeamIdsKey()
  return null
}
function Surfaces(): React.JSX.Element {
  return (
    <>
      <Page />
      <Sidebar />
      <Reader />
    </>
  )
}

const flush = () => act(async () => {})
const ids = (state: BotTeamsState | null) => state?.teams?.map((entry) => entry.id)
let root: Root

beforeEach(async () => {
  vi.useFakeTimers()
  host.current = 'local'
  listBotTeams.mockReset()
  listBotTeams.mockResolvedValue([team('a'), team('b')])
  root = createRoot(document.createElement('div'))
  act(() => root.render(<Surfaces />))
  await flush()
})

afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

describe('useBotTeams', () => {
  it('shows a change made on one surface on every other surface at once', async () => {
    expect(ids(seen.sidebar)).toEqual(['a', 'b'])
    listBotTeams.mockResolvedValue([team('b')])
    await act(async () => {
      await seen.page?.applyChange(async () => {})
    })
    expect(ids(seen.page)).toEqual(['b'])
    expect(ids(seen.sidebar)).toEqual(['b'])
    expect(seen.key).toBe('b')
  })

  it('asks the host once however many surfaces are open', async () => {
    expect(listBotTeams).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(listBotTeams).toHaveBeenCalledTimes(2)
  })

  it('does not bring back a deleted team when an older answer arrives late', async () => {
    let answerOld!: (teams: BotTeam[]) => void
    listBotTeams.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve)))
    act(() => seen.page?.reload())
    listBotTeams.mockResolvedValue([team('b')])
    await act(async () => {
      await seen.page?.applyChange(async () => {})
    })
    await act(async () => answerOld([team('a'), team('b')]))
    expect(ids(seen.sidebar)).toEqual(['b'])
  })

  it('shows nothing from the old host after the host changes', async () => {
    let answerNew!: (teams: BotTeam[]) => void
    listBotTeams.mockReturnValueOnce(new Promise((resolve) => (answerNew = resolve)))
    host.current = 'paired'
    act(() => root.render(<Surfaces />))
    await flush()
    expect(seen.page?.teams).toBeNull()
    expect(seen.sidebar?.teams).toBeNull()
    await act(async () => answerNew([team('z')]))
    expect(ids(seen.sidebar)).toEqual(['z'])
  })

  it('stops asking once no surface is open', async () => {
    act(() => root.render(null))
    listBotTeams.mockClear()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(listBotTeams).not.toHaveBeenCalled()
  })
})
