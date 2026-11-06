import { describe, expect, it } from 'vitest'
import {
  applyBotTeamComposerItem,
  botTeamComposerMenu,
  botTeamMentionOpen,
  botTeamProjectLogo
} from './bot-team-composer-menu'
import { findMentionedBot } from './bot-team-owner-selection'

const BOTS = [
  { id: 'a', name: 'Nora', job: 'Writes offers', agent: 'claude' as const },
  { id: 'b', name: 'Max Power', job: '', agent: 'pi' as const }
]

const inserts = (text: string, extra: object = {}) =>
  botTeamComposerMenu({ text, caret: text.length, bots: BOTS, ...extra })?.items.map(
    (item) => item.insert
  )

describe('botTeamComposerMenu', () => {
  it('offers the bots of the team after @, filtered by what was typed', () => {
    expect(inserts('@')).toEqual(['@Nora ', '@Max Power '])
    expect(inserts('please ask @no')).toEqual(['@Nora '])
  })

  it('offers files after the bots', () => {
    expect(inserts('@no', { files: ['brief/notes.md', 'logo.png'] })).toEqual([
      '@Nora ',
      '@brief/notes.md '
    ])
  })

  it('offers installed apps last, after the files, and keeps them when files fill the menu', () => {
    const apps = [
      { id: 'engram' as const, name: 'Engram' },
      { id: 'github' as const, name: 'GitHub' }
    ]
    expect(inserts('@', { files: ['notes.md'], apps })).toEqual([
      '@Nora ',
      '@Max Power ',
      '@notes.md ',
      '@Engram ',
      '@GitHub '
    ])
    expect(inserts('@git', { apps })).toEqual(['@GitHub '])
    const files = Array.from({ length: 20 }, (_, index) => `file${index}.md`)
    const items = botTeamComposerMenu({ text: '@', caret: 1, bots: BOTS, files, apps })?.items
    expect(items).toHaveLength(12)
    expect(items?.slice(-2).map((item) => item.kind)).toEqual(['app', 'app'])
  })

  it('keeps room for files when bots, teams and apps would fill the menu', () => {
    const bots = Array.from({ length: 14 }, (_, index) => ({
      id: `b${index}`,
      name: `Bot${index}`,
      job: '',
      agent: 'claude' as const
    }))
    const apps = [{ id: 'engram' as const, name: 'Engram' }]
    const items = botTeamComposerMenu({
      text: '@',
      caret: 1,
      bots,
      files: ['attachments/from-desarrollo-A-2.html'],
      apps
    })?.items
    expect(items).toHaveLength(12)
    expect(items?.map((item) => item.insert)).toContain('@attachments/from-desarrollo-A-2.html ')
  })

  it('offers the other teams between the bots and the files, each with its character', () => {
    const teams = [
      { id: 'wh', name: 'Warehouse', character: 'square' as const },
      { id: 'no', name: 'Nora Labs', character: 'blob' as const }
    ]
    const menu = botTeamComposerMenu({
      text: '@no',
      caret: 3,
      bots: BOTS,
      teams,
      files: ['notes.md']
    })
    expect(menu?.items.map((item) => item.insert)).toEqual(['@Nora ', '@Nora Labs ', '@notes.md '])
    expect(menu?.items[1]).toMatchObject({ kind: 'team', team: { id: 'no', character: 'blob' } })
    expect(inserts('@', { teams })).toEqual(['@Nora ', '@Max Power ', '@Warehouse ', '@Nora Labs '])
  })

  it('offers the projects after the teams and before the files, each with its logo or none', () => {
    const logo = { type: 'emoji' as const, emoji: '🛒' }
    const projects = [
      { id: 'p1', name: 'Nordic shop', logo },
      { id: 'p2', name: 'Spring campaign', logo: null }
    ]
    const menu = botTeamComposerMenu({
      text: '@no',
      caret: 3,
      bots: BOTS,
      teams: [{ id: 'no', name: 'Nora Labs', character: 'blob' as const }],
      projects,
      files: ['notes.md']
    })
    expect(menu?.items.map((item) => item.insert)).toEqual([
      '@Nora ',
      '@Nora Labs ',
      '@Nordic shop ',
      '@notes.md '
    ])
    expect(menu?.items[2]).toMatchObject({ kind: 'project', project: { id: 'p1', logo } })
    expect(inserts('@spr', { projects })).toEqual(['@Spring campaign '])
  })

  it('reads an image or emoji as a project logo, and the generic icon as none', () => {
    expect(botTeamProjectLogo({ type: 'emoji', emoji: '🛒' })).toEqual({
      type: 'emoji',
      emoji: '🛒'
    })
    expect(botTeamProjectLogo({ type: 'image', src: 'a.png', source: 'upload' })).not.toBeNull()
    expect(botTeamProjectLogo({ type: 'lucide', name: 'Folder' })).toBeNull()
    expect(botTeamProjectLogo(undefined)).toBeNull()
  })

  it('does not open inside an email or after the mention closes', () => {
    expect(inserts('me@no')).toBeUndefined()
    expect(inserts('@Nora hello')).toBeUndefined()
  })

  it('offers commands only at the start of the message, and only when the surface has them', () => {
    const commands = ['resume', 'session'] as const
    expect(inserts('/', { commands })).toEqual(['/resume', '/session'])
    expect(inserts('/se', { commands })).toEqual(['/session'])
    expect(inserts('hello /se', { commands })).toBeUndefined()
    expect(inserts('/')).toBeUndefined()
  })

  it('replaces the typed token and leaves the rest', () => {
    const text = 'ask @no about this'
    const menu = botTeamComposerMenu({ text, caret: 7, bots: BOTS })
    expect(menu).not.toBeNull()
    if (menu) {
      expect(applyBotTeamComposerItem(text, menu, menu.items[0])).toEqual({
        text: 'ask @Nora  about this',
        caret: 10
      })
    }
  })
})

describe('findMentionedBot', () => {
  it('finds a bot whose name also starts a longer mention earlier in the text', () => {
    const bots = [{ id: 'm', name: 'Max' }]
    expect(findMentionedBot('@Maximo and @Max', bots)?.id).toBe('m')
    expect(findMentionedBot('@Maximo only', bots)).toBeNull()
  })
})

describe('botTeamMentionOpen', () => {
  it('is true while a mention is being typed, and only then', () => {
    expect(botTeamMentionOpen('@', 1)).toBe(true)
    expect(botTeamMentionOpen('please ask @no', 14)).toBe(true)
    expect(botTeamMentionOpen('me@no', 5)).toBe(false)
    expect(botTeamMentionOpen('@Nora hello', 11)).toBe(false)
    expect(botTeamMentionOpen('@Nora hello', 3)).toBe(true)
  })
})
