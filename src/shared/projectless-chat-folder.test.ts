import { describe, expect, it } from 'vitest'
import {
  formatChatDateFolder,
  projectlessChatFolderSegments,
  slugifyChatTitle
} from './projectless-chat-folder'

describe('slugifyChatTitle', () => {
  it('lowercases, folds diacritics, and joins words with dashes', () => {
    expect(slugifyChatTitle('  Ñandú & Café: Plan Q3!  ')).toBe('nandu-cafe-plan-q3')
  })

  it('falls back to "chat" when nothing Latin remains', () => {
    expect(slugifyChatTitle('')).toBe('chat')
    expect(slugifyChatTitle('!!! ---')).toBe('chat')
    expect(slugifyChatTitle('修复登录')).toBe('chat')
  })

  it('caps length at 40 characters without leaving a trailing dash', () => {
    const slug = slugifyChatTitle(`${'a'.repeat(39)} bbbbbbbb`)
    expect(slug).toBe('a'.repeat(39))
    expect(slug.length).toBeLessThanOrEqual(40)
  })
})

describe('formatChatDateFolder', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(formatChatDateFolder(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(formatChatDateFolder(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

describe('projectlessChatFolderSegments', () => {
  const date = new Date(2026, 4, 9, 10, 30)

  it('returns the date folder and slug for the first attempt', () => {
    expect(projectlessChatFolderSegments(date, 'Fix login bug')).toEqual([
      '2026-05-09',
      'fix-login-bug'
    ])
  })

  it('suffixes later collision attempts', () => {
    expect(projectlessChatFolderSegments(date, 'Fix login bug', 2)).toEqual([
      '2026-05-09',
      'fix-login-bug-2'
    ])
    expect(projectlessChatFolderSegments(date, 'Fix login bug', 3)[1]).toBe('fix-login-bug-3')
  })
})
