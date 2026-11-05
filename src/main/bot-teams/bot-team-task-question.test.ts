import { afterEach, describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../shared/agent-session-journal-types'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { lastAssistantReplyOf, postBotTeamTaskQuestion } from './bot-team-task-question'

const REPLY = [
  'La imagen muestra el buscador de medicamentos de OPPM Web; no incluye una tabla de datos. ¿Qué resultado necesitas que produzca a partir de esta captura?',
  '',
  '**Siguiente Paso** — Tú: Indicar el objetivo del trabajo con el adjunto.'
].join('\n')
const QUESTION = '¿Qué resultado necesitas que produzca a partir de esta captura?'

describe('posting the question a bot ends its turn with', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function startedTask() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Catalina', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Revisión de captura',
      prompt: 'Mira esta imagen',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    db.setBotTeamTaskLastStatus('session-1', 'Done')
    return task
  }

  const finish = (reply: string | null) => ({ settleMs: 0, lastReplyOf: async () => reply })
  const roomLines = (teamId: string) => db!.listBotTeamMessages(teamId).map((m) => m.text)

  it('posts only the question to the room as the bot, and the task waits for the person', async () => {
    const task = startedTask()

    await postBotTeamTaskQuestion(db!, 'session-1', finish(REPLY))

    const posted = db!.listBotTeamMessages(task.teamId)
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ authorBotId: task.ownerBotId, text: QUESTION })
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBe(true)
    expect(db!.getBotTeamTask(task.id).lastStatus).toBe('Done')
  })

  it('does not post the question again when the bot already asked it in the room', async () => {
    const task = startedTask()
    db!.postBotTeamMessage({
      teamId: task.teamId,
      authorBotId: task.ownerBotId,
      text: 'Vi la captura. ¿Qué resultado necesitas que produzca a partir de esta captura?'
    })

    await postBotTeamTaskQuestion(db!, 'session-1', finish(REPLY))

    expect(roomLines(task.teamId)).toHaveLength(1)
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBe(true)
  })

  it('posts the same finish once even when it is reported twice', async () => {
    const task = startedTask()

    await postBotTeamTaskQuestion(db!, 'session-1', finish(REPLY))
    await postBotTeamTaskQuestion(db!, 'session-1', finish(REPLY))

    expect(roomLines(task.teamId)).toEqual([QUESTION])
  })

  it('posts nothing and does not wait when the turn ends without a question', async () => {
    const task = startedTask()

    await postBotTeamTaskQuestion(db!, 'session-1', finish('Listo. Guardé flyer.png.'))
    await postBotTeamTaskQuestion(db!, 'session-1', finish(null))

    expect(roomLines(task.teamId)).toEqual([])
    expect(db!.getBotTeamTask(task.id).awaitingPerson).toBeUndefined()
  })

  it('leaves a session that no task runs alone', async () => {
    const task = startedTask()

    await postBotTeamTaskQuestion(db!, 'other-session', finish(REPLY))

    expect(roomLines(task.teamId)).toEqual([])
  })
})

describe('reading the bot’s last reply from its session', () => {
  const message = (
    role: 'user' | 'assistant' | 'reasoning',
    text: string,
    sequence: number,
    agentId?: string
  ): AgentJournalRenderItem =>
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the reader looks only at the body, the sequence and the agent id.
    ({
      itemId: `i${sequence}`,
      revision: 1,
      sequence,
      observedAt: sequence,
      ...(agentId ? { agentId } : {}),
      body: { kind: 'message', role, blocks: [{ type: 'text', text }] }
    }) as AgentJournalRenderItem

  it('takes the last thing the bot itself said since the person last spoke', () => {
    expect(
      lastAssistantReplyOf([
        message('user', 'go', 1),
        message('assistant', 'Working on it.', 2),
        message('assistant', 'Which tab?', 3),
        message('assistant', 'A helper said this', 4, 'sub-1'),
        message('reasoning', 'thinking', 5)
      ])
    ).toBe('Which tab?')
  })

  it('finds nothing when the person spoke last', () => {
    expect(
      lastAssistantReplyOf([message('assistant', 'Which tab?', 1), message('user', 'This one', 2)])
    ).toBeNull()
  })
})
