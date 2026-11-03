/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { unseenBotTeamFiles, useBotTeamSeenFilesStore } from './bot-team-file-read-state'

const STORAGE_KEY = 'orca.botTeams.seenFiles'

beforeEach(() => {
  localStorage.clear()
  useBotTeamSeenFilesStore.setState({ seen: {} })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('the files a person has not opened yet', () => {
  it('counts nothing as new the first time a team is listed', () => {
    useBotTeamSeenFilesStore.getState().seedTeam('t1', ['brief.md'])

    const seen = useBotTeamSeenFilesStore.getState().seen.t1

    expect(unseenBotTeamFiles(['brief.md', 'deck.html'], seen)).toEqual(['deck.html'])
  })

  it('stops counting a file once the person opens it, and keeps that across a reload', async () => {
    const store = useBotTeamSeenFilesStore.getState()
    store.seedTeam('t1', ['brief.md'])
    store.markSeen('t1', 'deck.html')

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      t1: ['brief.md', 'deck.html']
    })
    vi.resetModules()
    const reloaded = await import('./bot-team-file-read-state')
    const seen = reloaded.useBotTeamSeenFilesStore.getState().seen.t1

    expect(reloaded.unseenBotTeamFiles(['brief.md', 'deck.html'], seen)).toEqual([])
  })

  it('keeps each team apart', () => {
    const store = useBotTeamSeenFilesStore.getState()
    store.seedTeam('t1', [])
    store.seedTeam('t2', ['x.md'])

    expect(
      unseenBotTeamFiles(['x.md', 'y.md'], useBotTeamSeenFilesStore.getState().seen.t1)
    ).toEqual(['x.md', 'y.md'])
    expect(unseenBotTeamFiles(['x.md'], useBotTeamSeenFilesStore.getState().seen.t2)).toEqual([])
  })

  it('reports nothing for a team with no record yet', () => {
    expect(unseenBotTeamFiles(['x.md'], undefined)).toEqual([])
  })

  it('still works when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.resetModules()
    const blocked = await import('./bot-team-file-read-state')

    blocked.useBotTeamSeenFilesStore.getState().seedTeam('t1', ['a.md'])
    blocked.useBotTeamSeenFilesStore.getState().markSeen('t1', 'b.md')

    expect(
      blocked.unseenBotTeamFiles(
        ['a.md', 'b.md'],
        blocked.useBotTeamSeenFilesStore.getState().seen.t1
      )
    ).toEqual([])
  })
})
