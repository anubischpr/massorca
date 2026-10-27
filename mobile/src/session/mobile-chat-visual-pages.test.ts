import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { mobileNativeChatVisualPages } from './mobile-chat-visual-pages'

function reply(id: string, text: string, timestamp: number | null): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [{ type: 'text', text }],
    timestamp,
    source: 'transcript'
  }
}

describe('mobileNativeChatVisualPages', () => {
  it('lists each directive file once, in the order it was first shown', () => {
    const pages = mobileNativeChatVisualPages([
      reply('a', '::orca-visual{file="usage-chart-3f2a.html" title="Usage"}', 1_000),
      reply(
        'b',
        '::orca-visual{file="costs.html"}\n\n::orca-visual{file="usage-chart-3f2a.html"}',
        2_000
      )
    ])
    expect(pages.map((page) => page.file)).toEqual(['usage-chart-3f2a.html', 'costs.html'])
  })

  it('keeps the latest timestamp and the first title a file was shown with', () => {
    const [page] = mobileNativeChatVisualPages([
      reply('a', '::orca-visual{file="usage.html" title="Usage"}', 1_000),
      reply('b', '::orca-visual{file="usage.html"}', 5_000)
    ])
    expect(page).toEqual({ file: 'usage.html', title: 'Usage', timestamp: 5_000 })
  })

  it('ignores user prompts, subagent replies, and directives inside code', () => {
    const user: NativeChatMessage = {
      id: 'user',
      role: 'user',
      blocks: [{ type: 'text', text: '::orca-visual{file="prompt.html"}' }],
      timestamp: 1,
      source: 'transcript'
    }
    const subagent: NativeChatMessage = {
      ...reply('sub', '::orca-visual{file="child.html"}', 2),
      agentId: 'sub-1'
    }
    const fenced = reply('code', '```\n::orca-visual{file="fenced.html"}\n```', 3)
    expect(mobileNativeChatVisualPages([user, subagent, fenced])).toEqual([])
  })

  it('reads directives from text blocks only', () => {
    const toolOnly: NativeChatMessage = {
      id: 'tool',
      role: 'assistant',
      blocks: [{ type: 'tool-call', name: 'write_file', input: {}, state: 'completed' }],
      timestamp: 1,
      source: 'transcript'
    }
    expect(mobileNativeChatVisualPages([toolOnly])).toEqual([])
  })
})
