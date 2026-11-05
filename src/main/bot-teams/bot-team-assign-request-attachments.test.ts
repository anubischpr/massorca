import { describe, expect, it } from 'vitest'
import { BotTeamRequestAssign } from '../../shared/rpc-contract/bot-team-room-params'
import { botTeamFilesOnlyText } from '../../shared/bot-team-room-attachments-line'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { fileBotTeamRequest } from './bot-team-assign-request'

function makeTeam(db: OrchestrationDb): string {
  return db.createBotTeam({
    name: 'Marketing',
    purpose: '',
    character: 'circle',
    workspacesEnabled: false,
    bots: [{ name: 'Iris', job: '', agent: 'claude' }]
  }).id
}

const notStarted = async (): Promise<never> => {
  throw new Error('the task should wait in Todo')
}

describe('filing a request with its files', () => {
  it('saves the attached paths with the task so its prompt names them', async () => {
    const db = new OrchestrationDb(':memory:')
    try {
      const teamId = makeTeam(db)
      const filed = await fileBotTeamRequest(
        db,
        {
          teamId,
          text: 'Revisa el flyer',
          start: false,
          later: false,
          askProject: false,
          attachments: [{ path: 'attachments/flyer.png', name: 'flyer.png' }]
        },
        notStarted
      )

      expect(filed.task).not.toBeNull()
      expect(db.getBotTeamTaskStartNotes(filed.task?.id ?? '')).toBe(
        'Files attached to the team folder: attachments/flyer.png'
      )
      expect(filed.task?.prompt).toBe('Revisa el flyer')
    } finally {
      db.close()
    }
  })

  it('files the answer to the project question for a message of only files', async () => {
    const db = new OrchestrationDb(':memory:')
    try {
      const teamId = makeTeam(db)
      const flyer = { path: 'attachments/flyer.png', name: 'flyer.png' }
      // The room's pending choice sends back the text it held: empty, with the files.
      const filed = await fileBotTeamRequest(
        db,
        {
          teamId,
          text: '',
          start: false,
          later: false,
          askProject: true,
          projectId: null,
          attachments: [flyer]
        },
        notStarted
      )

      expect(filed.choice).toBeUndefined()
      expect(filed.task?.prompt).toBe(botTeamFilesOnlyText([flyer], ''))
      expect(filed.task?.title).not.toBe('')
    } finally {
      db.close()
    }
  })

  it('still refuses a request with neither text nor files, and keeps typed text as is', () => {
    const flyer = { path: 'attachments/flyer.png', name: 'flyer.png' }
    expect(
      BotTeamRequestAssign.safeParse({ teamId: 't', text: '', start: true, attachments: [flyer] })
        .success
    ).toBe(true)
    expect(BotTeamRequestAssign.safeParse({ teamId: 't', text: '', start: true }).success).toBe(
      false
    )
    expect(
      BotTeamRequestAssign.safeParse({ teamId: 't', text: 'Revisa el flyer', start: true }).success
    ).toBe(true)
  })

  it('keeps a request with no files without start notes', async () => {
    const db = new OrchestrationDb(':memory:')
    try {
      const teamId = makeTeam(db)
      const filed = await fileBotTeamRequest(
        db,
        { teamId, text: 'Revisa el flyer', start: false, later: false, askProject: false },
        notStarted
      )

      expect(db.getBotTeamTaskStartNotes(filed.task?.id ?? '')).toBeNull()
    } finally {
      db.close()
    }
  })
})
