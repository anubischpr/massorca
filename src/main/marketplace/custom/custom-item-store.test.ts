import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCustomItemStore, type StoredCustomItem } from './custom-item-store'

const tool: StoredCustomItem = {
  id: 'item-1',
  kind: 'tool',
  name: 'MyTool',
  checkCommand: ['mytool', '--version'],
  install: { win32: ['winget', 'install', 'mytool'] },
  createdAt: 1_000
}

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-custom-store-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('createCustomItemStore', () => {
  it('reads an empty list when no file exists yet', () => {
    expect(createCustomItemStore(join(dir, 'custom.json')).read()).toEqual([])
  })

  it('reads back what it wrote, including a skill link and an install record', () => {
    const store = createCustomItemStore(join(dir, 'custom.json'))
    const skill: StoredCustomItem = {
      id: 'item-2',
      kind: 'skill',
      name: 'Review',
      checkCommand: null,
      install: {},
      skillUrl: 'https://example.com/skills/review',
      createdAt: 2_000,
      massorcaInstalledAt: 3_000
    }
    store.write([tool, skill])
    expect(store.read()).toEqual([tool, skill])
  })

  it('creates the folder and leaves no temporary file behind', () => {
    const folder = join(dir, 'marketplace')
    createCustomItemStore(join(folder, 'custom.json')).write([tool])
    expect(readdirSync(folder)).toEqual(['custom.json'])
    expect(JSON.parse(readFileSync(join(folder, 'custom.json'), 'utf8'))).toEqual({
      version: 1,
      items: [tool]
    })
  })

  it('reads null for a file it cannot parse, so a write never replaces it silently', () => {
    const file = join(dir, 'custom.json')
    writeFileSync(file, '{ broken')
    expect(createCustomItemStore(file).read()).toBeNull()
  })

  it('reads null for a file with the wrong shape', () => {
    const file = join(dir, 'custom.json')
    writeFileSync(file, JSON.stringify({ version: 2, items: [] }))
    expect(createCustomItemStore(file).read()).toBeNull()
  })
})
