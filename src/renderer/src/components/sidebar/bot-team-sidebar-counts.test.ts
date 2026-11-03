import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listBotTeamRoom = vi.hoisted(() => vi.fn())
const currentBotTeamHost = vi.hoisted(() => vi.fn(() => 'local'))
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeamRoom }))
vi.mock('@/runtime/bot-team-host', () => ({ currentBotTeamHost }))

const {
  botTeamRoomCountsKey,
  loadBotTeamRoomCounts,
  resetBotTeamRoomCountsForTests,
  useBotTeamRoomCountsStore
} = await import('./bot-team-sidebar-counts')

const room = (count: number) => ({
  messages: [],
  projects: [],
  tasks: Array.from({ length: count }, (_, index) => ({
    id: `k${index}`,
    teamId: 't1',
    title: 'Flyer',
    prompt: 'Flyer',
    ownerBotId: 'b1',
    sessionId: null,
    projectId: null
  }))
})

const taskCount = (teamId: string, host = 'local'): number | undefined =>
  useBotTeamRoomCountsStore.getState().answers[botTeamRoomCountsKey(host, teamId)]?.tasks.length

const never = (): Promise<never> => new Promise<never>(() => {})

beforeEach(() => {
  vi.useFakeTimers()
  listBotTeamRoom.mockReset()
  currentBotTeamHost.mockReturnValue('local')
  resetBotTeamRoomCountsForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the Bot teams sidebar counts store', () => {
  it('shares one request between callers that join while it runs', () => {
    listBotTeamRoom.mockReturnValue(never())
    void loadBotTeamRoomCounts('t1')
    void loadBotTeamRoomCounts('t1')
    expect(listBotTeamRoom).toHaveBeenCalledTimes(1)
  })

  it('asks every team at once rather than one after another', () => {
    listBotTeamRoom.mockReturnValue(never())
    void loadBotTeamRoomCounts('t1')
    void loadBotTeamRoomCounts('t2')
    expect(listBotTeamRoom.mock.calls.map(([teamId]) => teamId)).toEqual(['t1', 't2'])
  })

  it('queues a fresh call behind the request in flight and never runs two at once', async () => {
    let answerFirst!: (value: unknown) => void
    listBotTeamRoom.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve
      })
    )
    listBotTeamRoom.mockResolvedValueOnce(room(2))
    void loadBotTeamRoomCounts('t1')
    const fresh = loadBotTeamRoomCounts('t1', { fresh: true })
    expect(listBotTeamRoom).toHaveBeenCalledTimes(1)
    answerFirst(room(1))
    await fresh
    expect(listBotTeamRoom).toHaveBeenCalledTimes(2)
    expect(taskCount('t1')).toBe(2)
  })

  it('gives up on a request that never answers, so the next call asks again', async () => {
    listBotTeamRoom.mockReturnValueOnce(never())
    void loadBotTeamRoomCounts('t1')
    await vi.advanceTimersByTimeAsync(15_000)
    listBotTeamRoom.mockResolvedValueOnce(room(1))
    await loadBotTeamRoomCounts('t1')
    expect(listBotTeamRoom).toHaveBeenCalledTimes(2)
    expect(taskCount('t1')).toBe(1)
  })

  it('drops an answer that arrives after its request was given up', async () => {
    let lateAnswer!: (value: unknown) => void
    listBotTeamRoom.mockReturnValueOnce(
      new Promise((resolve) => {
        lateAnswer = resolve
      })
    )
    void loadBotTeamRoomCounts('t1')
    await vi.advanceTimersByTimeAsync(15_000)
    listBotTeamRoom.mockResolvedValueOnce(room(2))
    await loadBotTeamRoomCounts('t1')
    lateAnswer(room(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(taskCount('t1')).toBe(2)
  })

  it('keeps each host’s answers apart', async () => {
    listBotTeamRoom.mockResolvedValueOnce(room(1))
    await loadBotTeamRoomCounts('t1')
    expect(taskCount('t1', 'local')).toBe(1)
    expect(taskCount('t1', 'environment-2')).toBeUndefined()
  })
})
