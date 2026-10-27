import { describe, expect, it } from 'vitest'
import {
  createProjectlessChatId,
  formatChatDateFolder,
  projectlessChatFolderSegments
} from './projectless-chat-folder'

describe('createProjectlessChatId', () => {
  it('makes a six character lowercase id from the random source', () => {
    expect(createProjectlessChatId(() => 0)).toBe('000000')
    expect(createProjectlessChatId(() => 0.999999)).toBe('zzzzzz')
  })

  it('stays filename-safe for ids drawn from Math.random', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(createProjectlessChatId()).toMatch(/^[0-9a-z]{6}$/)
    }
  })
})

describe('formatChatDateFolder', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(formatChatDateFolder(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(formatChatDateFolder(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

describe('projectlessChatFolderSegments', () => {
  it('returns the date folder and the chat id', () => {
    expect(projectlessChatFolderSegments(new Date(2026, 4, 9, 10, 30), 'k3x9qa')).toEqual([
      '2026-05-09',
      'k3x9qa'
    ])
  })
})
