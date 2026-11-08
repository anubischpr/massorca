import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from './agent-session-journal-types'
import { environmentUrlsFromJournalItems, isEnvironmentUrl } from './native-chat-environment-urls'

function item(
  body: AgentJournalRenderItem['body'],
  sequence: number,
  agentId?: string
): AgentJournalRenderItem {
  return {
    itemId: `item-${sequence}`,
    sequence,
    revision: 1,
    observedAt: 100,
    body,
    ...(agentId ? { agentId } : {})
  }
}

function output(head: string) {
  return { head, byteLength: head.length, digest: 'd', truncated: false }
}

function command(text: string, sequence: number, name = 'Bash'): AgentJournalRenderItem {
  return item(
    {
      kind: 'tool-call',
      name,
      input: { command: 'run' },
      state: 'completed',
      output: output(text)
    },
    sequence
  )
}

function reply(text: string, sequence: number, agentId?: string): AgentJournalRenderItem {
  return item(
    { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text }] },
    sequence,
    agentId
  )
}

describe('isEnvironmentUrl', () => {
  it.each([
    'http://localhost:5173/',
    'http://127.0.0.1:8000/api',
    'http://192.168.1.20:3000',
    'http://app.localhost',
    'https://example.com:8443/',
    'https://myapp-h4sh-team.vercel.app',
    'https://feature-x--site.netlify.app',
    'https://staging.example.com',
    'https://app-preview.example.co.uk/login',
    'https://abc123.ngrok-free.app'
  ])('includes %s', (url) => {
    expect(isEnvironmentUrl(url)).toBe(true)
  })

  it.each([
    'https://github.com/org/repo/pull/12',
    'https://gitlab.com/org/repo/-/merge_requests/3',
    'https://example.com/org/repo/issues/4',
    'https://docs.example.com/guide',
    'https://developer.mozilla.org/en-US/docs/Web',
    'https://www.npmjs.com/package/vite',
    'https://example.com',
    'https://dev.to/some-post',
    'https://mysite.dev',
    'ftp://localhost:21',
    'not a url'
  ])('excludes %s', (url) => {
    expect(isEnvironmentUrl(url)).toBe(false)
  })
})

describe('environmentUrlsFromJournalItems', () => {
  it('reads dev-server banners from command output for every provider tool name', () => {
    const urls = environmentUrlsFromJournalItems([
      command('VITE ready\n  ➜  Local:   http://localhost:5173/\n', 1),
      command('Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C)', 2, 'exec_command'),
      command('Listening on http://localhost:4000.', 3, 'run_shell_command')
    ])
    expect(urls.map((entry) => entry.url)).toEqual([
      'http://localhost:4000',
      'http://127.0.0.1:8000',
      'http://localhost:5173'
    ])
    expect(urls.every((entry) => entry.source === 'tool-output' && entry.loopback)).toBe(true)
  })

  it('ignores URLs in file reads and non-environment links in command output', () => {
    expect(
      environmentUrlsFromJournalItems([
        item(
          {
            kind: 'tool-call',
            name: 'Read',
            input: { file_path: 'vite.config.ts' },
            state: 'completed',
            output: output("server: { origin: 'http://localhost:5173' }")
          },
          1
        ),
        command('See https://github.com/org/repo/pull/7 and https://docs.vercel.com/cli', 2)
      ])
    ).toEqual([])
  })

  it('takes a deploy URL from an MCP tool output', () => {
    const urls = environmentUrlsFromJournalItems([
      item(
        {
          kind: 'tool-call',
          name: 'mcp__vercel__deploy',
          input: {},
          state: 'completed',
          output: output('{"url":"https://shop-abc.vercel.app"}')
        },
        1
      )
    ])
    expect(urls.map((entry) => entry.url)).toEqual(['https://shop-abc.vercel.app'])
  })

  it('takes a URL the agent hands over to test, and skips its other links', () => {
    const urls = environmentUrlsFromJournalItems([
      reply(
        'Deployed. Test it at https://shop.example.com/checkout.\n' +
          'Docs: https://docs.example.com/deploy and PR https://github.com/org/repo/pull/9\n' +
          'Background reading: https://example.org/blog',
        1
      )
    ])
    expect(urls).toEqual([
      {
        url: 'https://shop.example.com/checkout',
        source: 'agent-reply',
        itemId: 'item-1',
        loopback: false,
        previous: false
      }
    ])
  })

  it('ignores subagent replies and user prompts', () => {
    expect(
      environmentUrlsFromJournalItems([
        item(
          {
            kind: 'message',
            role: 'user',
            blocks: [{ type: 'text', text: 'test http://localhost:3000' }]
          },
          1
        ),
        reply('Test at http://localhost:3001', 2, 'subagent-1')
      ])
    ).toEqual([])
  })

  it('lists newest first, once per URL, and marks a replaced deploy previous', () => {
    const urls = environmentUrlsFromJournalItems([
      command('Preview: https://shop-aaa111.vercel.app', 1),
      command('Local: http://localhost:3000/', 2),
      command('Preview: https://shop-bbb222.vercel.app', 3),
      reply('Try http://localhost:3000 again.', 4)
    ])
    expect(urls.map(({ url, previous, source }) => ({ url, previous, source }))).toEqual([
      { url: 'http://localhost:3000', previous: false, source: 'agent-reply' },
      { url: 'https://shop-bbb222.vercel.app', previous: false, source: 'tool-output' },
      { url: 'https://shop-aaa111.vercel.app', previous: true, source: 'tool-output' }
    ])
  })

  it('keeps two dev servers on different ports current', () => {
    const urls = environmentUrlsFromJournalItems([
      command('web on http://localhost:5173', 1),
      command('api on http://localhost:8000', 2)
    ])
    expect(urls.map((entry) => entry.previous)).toEqual([false, false])
  })
})
