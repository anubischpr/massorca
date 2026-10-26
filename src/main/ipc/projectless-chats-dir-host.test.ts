import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getDefaultProjectlessChatsDir } from '../../shared/constants'
import { defaultProjectlessChatsDir, projectlessChatsDirPatch } from './projectless-chats-dir-host'

describe('projectless chats folder host settings', () => {
  it('answers the stock folder under this host home', () => {
    expect(defaultProjectlessChatsDir()).toBe(getDefaultProjectlessChatsDir(homedir()))
  })

  it('leaves settings alone when the renderer did not send the folder', () => {
    expect(projectlessChatsDirPatch({ nestWorkspaces: true })).toEqual({})
  })

  it('normalizes a blank folder to the stock folder and keeps an absolute one', () => {
    expect(projectlessChatsDirPatch({ projectlessChatsDir: ' ' })).toEqual({
      projectlessChatsDir: getDefaultProjectlessChatsDir(homedir())
    })
    expect(projectlessChatsDirPatch({ projectlessChatsDir: ' /work/chats ' })).toEqual({
      projectlessChatsDir: '/work/chats'
    })
  })
})
