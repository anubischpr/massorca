import { createElement, isValidElement, type ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { removeBotTeamMentionBeforeCaret } from '../../../src/shared/bot-team-mention-text'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import {
  applyAutocomplete,
  detectAutocompleteTrigger
} from '../session/mobile-native-chat-autocomplete'
import {
  MobileNativeChatComposerSuggestions,
  type ComposerSuggestion
} from '../session/MobileNativeChatComposerSuggestions'
import { botTeamMentionNodes, BotTeamMentionChip } from './MobileBotTeamMentionChip'
import { botTeamMentionTargets } from './mobile-bot-team-mention'
import { botTeamRoomSuggestions } from './MobileBotTeamRoomSuggestions'

vi.mock('react-native', async () => {
  const React = await import('react')
  return {
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Pressable: ({ children, style: _style, ...props }: { children?: ReactNode; style?: unknown }) =>
      React.createElement('Pressable', props, children),
    ScrollView: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('ScrollView', props, children),
    Text: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('Text', props, children),
    View: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children)
  }
})
vi.mock('lucide-react-native', () => ({
  Database: 'Database',
  File: 'File',
  FileArchive: 'FileArchive',
  FileAxis3d: 'FileAxis3D',
  FileBox: 'FileBox',
  FileBraces: 'FileBraces',
  FileChartColumn: 'FileChartColumn',
  FileCode: 'FileCode',
  FileCog: 'FileCog',
  FileDiff: 'FileDiff',
  FileImage: 'FileImage',
  FileJson: 'FileJson',
  FileKey: 'FileKey',
  FileLock: 'FileLock',
  FileMusic: 'FileMusic',
  FileSliders: 'FileSliders',
  FileSpreadsheet: 'FileSpreadsheet',
  FileTerminal: 'FileTerminal',
  FileText: 'FileText',
  FileType: 'FileType',
  FileVideo: 'FileVideo',
  Smartphone: 'Smartphone'
}))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'AgentIcon' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'RepoIcon' }))

const BOT = {
  id: 'iris',
  name: 'Iris',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}

function team(
  id: string,
  name: string,
  character: BotTeam['character'],
  bots: BotTeam['bots']
): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character,
    workspacesEnabled: false,
    accessMode: 'full-access',
    bots
  }
}

const ROOM = team('team', 'Marketing', 'circle', [BOT])
const WAREHOUSE = team('team_2', 'Warehouse', 'square', [{ ...BOT, id: 'max', name: 'Max' }])
const TARGETS = botTeamMentionTargets(ROOM, [ROOM, WAREHOUSE])
const LOGO = { type: 'emoji' as const, emoji: '🚀' }
const PROJECTS = [
  { id: 'p1', name: 'Launch', logo: LOGO },
  { id: 'p2', name: 'Launchpad', logo: null }
]

/** What the composer does on a tap: the trigger span takes the suggestion's insert, then a space. */
function tapSuggestion(text: string, label: string): { text: string; cursor: number } {
  const trigger = detectAutocompleteTrigger(text, text.length)
  const suggestion = (
    botTeamRoomSuggestions({
      text,
      caret: text.length,
      team: ROOM,
      otherTeams: [WAREHOUSE],
      projects: PROJECTS,
      files: ['flyer.md']
    }) ?? []
  ).find((item) => item.kind === 'custom' && item.label === label)
  if (!trigger || suggestion?.kind !== 'custom') {
    throw new Error(`no @ suggestion "${label}" for "${text}"`)
  }
  return applyAutocomplete(text, trigger, suggestion.insert)
}

/** The @ menu's rows for a typed query, as the composer lists them. */
function menuFor(text: string, files: readonly string[] = []): ComposerSuggestion[] {
  return (
    botTeamRoomSuggestions({
      text,
      caret: text.length,
      team: ROOM,
      otherTeams: [WAREHOUSE],
      projects: PROJECTS,
      files
    }) ?? []
  )
}

function rowNamed(rows: ComposerSuggestion[], label: string): ComposerSuggestion {
  const row = rows.find((item) => item.kind === 'custom' && item.label === label)
  if (!row) {
    throw new Error(`no @ suggestion "${label}"`)
  }
  return row
}

function iconOf(row: ComposerSuggestion): ReactNode {
  return row.kind === 'custom' ? row.icon : undefined
}

/** The host element an icon draws, or null when the row has none. */
function drawnType(icon: ReactNode): unknown {
  if (!isValidElement(icon)) {
    return null
  }
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(icon)
  })
  const json = renderer.toJSON()
  return json && !Array.isArray(json) ? json.type : null
}

function renderSent(text: string): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement('Text', null, botTeamMentionNodes(text, 'k', TARGETS)))
  })
  return renderer
}

describe('the phone @ menu, picked and then sent', () => {
  it('inserts a bot as @Name followed by exactly one space, where the caret waits', () => {
    expect(tapSuggestion('@Ir', 'Iris')).toEqual({ text: '@Iris ', cursor: 6 })
  })

  it('inserts a team the same way, keeping the text before the trigger', () => {
    expect(tapSuggestion('hola @War', 'Warehouse').text).toBe('hola @Warehouse ')
  })

  it('draws the sent mention as a chip labelled with the name alone', () => {
    const renderer = renderSent(`${tapSuggestion('@Ir', 'Iris').text}ya lo tiene`)
    const chips = renderer.root.findAll((node) => node.type === BotTeamMentionChip)

    expect(chips.map((chip) => chip.props.label)).toEqual(['Iris'])
  })

  it('lets one backspace remove a mention the phone inserted, as on the desktop', () => {
    const picked = tapSuggestion('@Ir', 'Iris').text

    expect(removeBotTeamMentionBeforeCaret(picked, picked.length, TARGETS)).toEqual({
      text: '',
      caret: 0
    })
  })
})

describe('the phone @ menu lists projects and files', () => {
  it('shows a project with a logo with that logo beside its name', () => {
    const row = rowNamed(menuFor('@Lau'), 'Launch')

    expect(row).toMatchObject({ kind: 'custom', insert: '@Launch', key: 'project:p1' })
    expect(isValidElement(iconOf(row))).toBe(true)
    expect(drawnType(iconOf(row))).toBe('RepoIcon')
  })

  it('shows a project without a logo with no icon at all', () => {
    const row = rowNamed(menuFor('@Launchp'), 'Launchpad')

    expect(row).toMatchObject({ kind: 'custom', insert: '@Launchpad' })
    expect(iconOf(row)).toBeUndefined()
  })

  it('inserts a project the same way as a bot, keeping the text before the trigger', () => {
    expect(tapSuggestion('hola @Lau', 'Launch').text).toBe('hola @Launch ')
  })

  it('gives each file the icon of its type', () => {
    const rows = menuFor('@', ['site/flyer.html', 'brief.md'])

    expect(drawnType(iconOf(rowNamed(rows, 'site/flyer.html')))).toBe('FileCode')
    expect(drawnType(iconOf(rowNamed(rows, 'brief.md')))).toBe('FileText')
  })
})

describe('the phone @ menu headings', () => {
  it('heads each kind once when the list mixes them, in the desktop order', () => {
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        createElement(MobileNativeChatComposerSuggestions, {
          suggestions: menuFor('@', ['site/flyer.html', 'brief.md']),
          onPick: () => {}
        })
      )
    })
    const headings = renderer.root
      .findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'header')
      .map((node) => node.props.children)

    expect(headings).toEqual(['Bots', 'Teams', 'Projects', 'Files'])
  })

  it('draws no heading when every row is one kind', () => {
    expect(menuFor('@Ir').every((row) => row.kind === 'custom' && row.group === undefined)).toBe(
      true
    )
  })
})
