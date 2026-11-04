import { describe, expect, it } from 'vitest'
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
