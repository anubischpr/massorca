import { describe, expect, it } from 'vitest'
import { joinNames, prototypeSystemCardOf, sourceNamesOf } from './prototype-design-system-card'

const TOKENS = JSON.stringify({
  color: {
    primary: { $value: '#1d4ed8' },
    foreground: { $value: '#0a0a0a' },
    muted: { $value: '#f5f5f5' },
    success: { $value: '#16a34a' },
    border: { $value: '#404040' }
  },
  $extensions: {
    massorca: {
      version: 2,
      status: 'detected',
      agent: 'Codex',
      sources: [
        { path: 'src/assets/main.css', took: 'colors' },
        { path: 'STYLEGUIDE.md', took: 'rules' }
      ]
    }
  }
})

describe('prototypeSystemCardOf', () => {
  it('describes an existing system with its version, token count, sources and request swatches', () => {
    expect(
      prototypeSystemCardOf({ projectKey: 'nexus', projectName: 'nexuscare', tokensJson: TOKENS })
    ).toEqual({
      kind: 'existing',
      projectKey: 'nexus',
      projectName: 'nexuscare',
      version: 2,
      tokenCount: 5,
      sourceNames: ['main.css', 'STYLEGUIDE.md'],
      swatches: ['#1d4ed8', '#0a0a0a', '#f5f5f5', '#16a34a']
    })
  })

  it('describes a project with no tokens file as having no design system', () => {
    expect(prototypeSystemCardOf({ projectKey: 'landing', projectName: 'landing-site' })).toEqual({
      kind: 'none',
      projectKey: 'landing',
      projectName: 'landing-site'
    })
  })

  it('shows no card for a tokens file the host could not read or parse', () => {
    expect(
      prototypeSystemCardOf({
        projectKey: 'nexus',
        projectName: 'nexuscare',
        unreadableFileNames: ['design/system/tokens.json']
      })
    ).toBeNull()
    expect(
      prototypeSystemCardOf({ projectKey: 'nexus', projectName: 'nexuscare', tokensJson: '[1]' })
    ).toBeNull()
  })
})

describe('sourceNamesOf', () => {
  it('names each source by its file, whichever separator its path uses', () => {
    expect(
      sourceNamesOf([
        { path: 'src/assets/main.css', took: '' },
        { path: 'src\\components\\ui', took: '' },
        { path: 'STYLEGUIDE.md', took: '' }
      ])
    ).toEqual(['main.css', 'ui', 'STYLEGUIDE.md'])
  })

  it('names nothing for no sources', () => {
    expect(sourceNamesOf([])).toEqual([])
  })
})

describe('joinNames', () => {
  it('joins two names with the conjunction and three or more with commas before it', () => {
    expect(joinNames(['main.css', 'STYLEGUIDE.md'], 'and')).toBe('main.css and STYLEGUIDE.md')
    expect(joinNames(['a.css', 'b.md', 'ui'], 'and')).toBe('a.css, b.md and ui')
  })

  it('gives one name alone and no name as nothing', () => {
    expect(joinNames(['main.css'], 'and')).toBe('main.css')
    expect(joinNames([], 'and')).toBe('')
  })
})
