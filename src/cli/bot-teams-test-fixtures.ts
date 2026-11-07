import type { Mock } from 'vitest'

/** Answers each RPC method from its own queue: one fixture, or a list read in order whose last entry repeats. */
export function routeRpcFixtures(mock: Mock, routes: Record<string, unknown>): void {
  const queues = new Map<string, unknown[]>(
    Object.entries(routes).map(([method, value]): [string, unknown[]] => [
      method,
      Array.isArray(value) ? [...value] : [value]
    ])
  )
  mock.mockImplementation(async (method: string) => {
    const queue = queues.get(method)
    if (!queue || queue.length === 0) {
      throw new Error(`No fixture routed for ${method}`)
    }
    return queue.length > 1 ? queue.shift() : queue[0]
  })
}

export const BOTS = [
  {
    id: 'bot-1',
    name: 'Estrellita',
    job: 'Support lead',
    agent: 'claude',
    modelMode: 'auto',
    model: null,
    effort: null,
    skills: []
  },
  {
    id: 'bot-2',
    name: 'Pepe',
    job: 'Reviews',
    agent: 'codex',
    modelMode: 'auto',
    model: null,
    effort: null,
    skills: []
  }
]

export const TEAM = {
  id: 'team-1',
  name: 'Support',
  purpose: '',
  character: 'focused',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: BOTS
}

export const OTHER_TEAM = {
  ...TEAM,
  id: 'team-2',
  name: 'Ops',
  bots: [{ ...BOTS[1], id: 'bot-5', name: 'Lupe' }]
}

export const TWIN_NAME_TEAM = {
  ...TEAM,
  bots: [
    ...BOTS,
    { ...BOTS[0], id: 'bot-3', name: 'ana' },
    { ...BOTS[0], id: 'bot-4', name: 'Ana' }
  ]
}

export const LAUNCH = {
  id: 'project-1',
  teamId: 'team-1',
  name: 'Launch',
  goal: 'Ship it',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null,
  workspace: null,
  linkedTeamIds: []
}

export const TASK_1 = {
  id: 'task-1',
  teamId: 'team-1',
  title: 'Fix flaky test',
  prompt: 'Fix it',
  ownerBotId: 'bot-1',
  sessionId: null,
  projectId: null,
  createdAt: 100,
  lastStatus: null
}

export const TASK_2 = {
  id: 'task-2',
  teamId: 'team-1',
  title: 'Write release notes',
  prompt: '',
  ownerBotId: 'bot-2',
  sessionId: 'session-2',
  projectId: 'project-1',
  createdAt: 200,
  lastStatus: 'Done'
}

export const TASK_3 = {
  id: 'task-3',
  teamId: 'team-1',
  title: 'Draft changelog',
  prompt: '',
  ownerBotId: 'bot-1',
  sessionId: 'session-3',
  projectId: null,
  createdAt: 300,
  lastStatus: null,
  awaitingPerson: true
}

export const PERSON_REQUEST = {
  id: 'msg-1',
  teamId: 'team-1',
  authorBotId: null,
  text: 'Please draft the notes',
  createdAt: 90,
  attachments: [{ path: 'attachments/brief.pdf', name: 'brief.pdf' }]
}

export const BOT_REPLY = {
  id: 'msg-2',
  teamId: 'team-1',
  authorBotId: 'bot-1',
  text: 'On it',
  createdAt: 95
}

export function roomWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tasks: [TASK_1, TASK_2, TASK_3],
    messages: [PERSON_REQUEST, BOT_REPLY],
    sentRequests: [],
    projects: [LAUNCH],
    workspaceId: null,
    replying: [],
    ...overrides
  }
}

export function assistantItem(text: string): Record<string, unknown> {
  return {
    itemId: 'item-1',
    revision: 1,
    sequence: 4,
    sequenceIndex: 0,
    observedAt: 1,
    body: { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text }] }
  }
}
