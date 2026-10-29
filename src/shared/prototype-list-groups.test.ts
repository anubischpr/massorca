import { describe, expect, it } from 'vitest'
import { buildPrototypeListGroups } from './prototype-list-groups'
import type { PrototypeListRow } from './prototype-list-model'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from './rpc-contract/prototype-params'

function set(requestId: string, project?: { key: string; name: string }): PrototypeListedSet {
  return {
    requestId,
    sessionId: 'session-alpha-0001',
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'a checkout page',
    createdAt: '2026-10-28T20:15:00.000Z',
    count: 2,
    directions: [],
    ...(project === undefined ? {} : { projectKey: project.key, projectName: project.name })
  }
}

function rowOf(listed: PrototypeListedSet): PrototypeListRow {
  return {
    set: listed,
    title: listed.requestId,
    mono: 'CL',
    status: { kind: 'single' },
    age: null
  }
}

function system(projectKey: string, projectName: string): PrototypeListedDesignSystem {
  return {
    projectKey,
    projectName,
    status: 'detected',
    version: 2,
    tokenCount: 24,
    swatches: []
  }
}

const NEXUS = { key: 'nexus', name: 'nexuscare' }
const LANDING = { key: 'landing', name: 'landing-site' }

describe('buildPrototypeListGroups', () => {
  it('orders the groups by their newest set and keeps each group’s rows in host order', () => {
    const sets = [set('r3', NEXUS), set('r2', LANDING), set('r1', NEXUS)]
    const groups = buildPrototypeListGroups({
      sets,
      rows: sets.map(rowOf),
      designSystems: []
    })
    expect(groups.map((group) => group.projectKey)).toEqual(['nexus', 'landing'])
    expect(groups[0]?.rows.map((row) => row.set.requestId)).toEqual(['r3', 'r1'])
    expect(groups[1]?.rows.map((row) => row.set.requestId)).toEqual(['r2'])
  })

  it('names each group after its project and pins the project’s design system to it', () => {
    const sets = [set('r2', LANDING), set('r1', NEXUS)]
    const groups = buildPrototypeListGroups({
      sets,
      rows: sets.map(rowOf),
      designSystems: [system('nexus', 'nexuscare')]
    })
    expect(groups.map((group) => group.projectName)).toEqual(['landing-site', 'nexuscare'])
    expect(groups[0]?.system).toBeNull()
    expect(groups[1]?.system).toMatchObject({ projectKey: 'nexus', version: 2 })
  })

  it('keeps a design system row when the agent filter hides every set of its project', () => {
    const sets = [set('r2', NEXUS), set('r1', LANDING)]
    const groups = buildPrototypeListGroups({
      sets,
      rows: [rowOf(sets[1] ?? set('r1', LANDING))],
      designSystems: [system('nexus', 'nexuscare')]
    })
    expect(groups).toEqual([
      expect.objectContaining({ projectKey: 'nexus', system: expect.anything(), rows: [] }),
      expect.objectContaining({ projectKey: 'landing', system: null })
    ])
  })

  it('leaves out a project with neither a visible set nor a design system', () => {
    const sets = [set('r1', NEXUS)]
    expect(buildPrototypeListGroups({ sets, rows: [], designSystems: [] })).toEqual([])
  })

  it('does not list a design system whose project has no listed set', () => {
    const sets = [set('r1', LANDING)]
    const groups = buildPrototypeListGroups({
      sets,
      rows: sets.map(rowOf),
      designSystems: [system('nexus', 'nexuscare')]
    })
    expect(groups.map((group) => group.projectKey)).toEqual(['landing'])
  })

  it('puts sets the host placed in no project in one last group without a name', () => {
    const sets = [set('r3'), set('r2', NEXUS), set('r1')]
    const groups = buildPrototypeListGroups({
      sets,
      rows: sets.map(rowOf),
      designSystems: []
    })
    expect(groups).toEqual([
      expect.objectContaining({ projectKey: 'nexus', rows: [expect.anything()] }),
      { projectKey: null, projectName: null, system: null, rows: expect.any(Array) }
    ])
    expect(groups[1]?.rows.map((row) => row.set.requestId)).toEqual(['r3', 'r1'])
  })
})
