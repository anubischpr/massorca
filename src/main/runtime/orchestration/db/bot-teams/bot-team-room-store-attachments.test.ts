import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team room store attachments', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function makeTeam(): { db: OrchestrationDb; teamId: string } {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    return { db, teamId: team.id }
  }

  it('keeps the files a message names and returns the visible text alone', () => {
    const { db, teamId } = makeTeam()
    const attachments = [{ path: 'attachments/flyer.png', name: 'flyer.png' }]

    const posted = db.postBotTeamMessage({
      teamId,
      text: 'Mira el flyer',
      authorBotId: null,
      attachments
    })

    expect(posted).toEqual(expect.objectContaining({ text: 'Mira el flyer', attachments }))
    expect(db.listBotTeamMessages(teamId)).toEqual([
      expect.objectContaining({ text: 'Mira el flyer', attachments })
    ])
  })

  it('leaves a message with no files as it was before attachments existed', () => {
    const { db, teamId } = makeTeam()

    const posted = db.postBotTeamMessage({ teamId, text: 'Hola', authorBotId: null })

    expect(posted).not.toHaveProperty('attachments')
    expect(db.listBotTeamMessages(teamId)).toEqual([
      { id: posted.id, teamId, authorBotId: null, text: 'Hola', createdAt: posted.createdAt }
    ])
  })
})
