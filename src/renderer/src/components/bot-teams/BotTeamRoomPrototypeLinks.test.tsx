/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type {
  BotTeamRoomReportMessage,
  BotTeamRoomReportTask
} from '../../../../shared/bot-team-room-prototype-tasks'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../prototypes/use-prototype-set-for-request', () => ({
  usePrototypeSetsOfSession: (scope: { sessionId: string } | null) =>
    scope?.sessionId === 's-1'
      ? [{ requestId: 'req-1', name: 'Launch flyer' }]
      : // The teammate ran the set the lead handed over, so both sessions match it.
        scope?.sessionId === 's-lead' || scope?.sessionId === 's-mate'
        ? [{ requestId: 'req-2', name: 'Handed set', sessionId: 's-mate' }]
        : []
}))
vi.mock('../native-chat/NativeChatPrototypeLinkCard', () => ({
  PrototypeSetLinkCard: ({ set }: { set: { name: string } }) => (
    <button type="button">Open {set.name} in Prototypes</button>
  )
}))

const { useBotTeamRoomPrototypeLinks } = await import('./BotTeamRoomPrototypeLinks')

const message = (
  id: string,
  authorBotId: string | null,
  createdAt: number
): BotTeamRoomReportMessage => ({ id, authorBotId, createdAt })
const task = (
  id: string,
  sessionId: string | null,
  createdAt: number,
  ownerBotId = 'b1'
): BotTeamRoomReportTask => ({
  id,
  teamId: 't1',
  ownerBotId,
  sessionId,
  createdAt
})

function Room({
  messages,
  tasks
}: {
  messages: BotTeamRoomReportMessage[]
  tasks: BotTeamRoomReportTask[]
}) {
  const links = useBotTeamRoomPrototypeLinks(messages, tasks, [], 't1')
  return messages.map((entry) => (
    <section key={entry.id} data-message={entry.id}>
      {links(entry.id)}
    </section>
  ))
}

describe('the room Prototypes links', () => {
  it("shows Open in Prototypes under the bot's report for the task that made the set", () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() =>
      root.render(
        <Room
          messages={[message('ask', null, 1), message('report', 'b1', 5)]}
          tasks={[task('task-1', 's-1', 2)]}
        />
      )
    )
    expect(container.querySelector('[data-message="ask"]')?.textContent).toBe('')
    expect(container.querySelector('[data-message="report"]')?.textContent).toBe(
      'Open Launch flyer in Prototypes'
    )
    act(() => root.unmount())
  })

  it("shows a teammate's set only under the teammate's report, not the lead's again", () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() =>
      root.render(
        <Room
          messages={[message('mate-report', 'mate', 5), message('lead-report', 'lead', 6)]}
          tasks={[task('lead-task', 's-lead', 1, 'lead'), task('mate-task', 's-mate', 2, 'mate')]}
        />
      )
    )
    expect(container.querySelector('[data-message="mate-report"]')?.textContent).toBe(
      'Open Handed set in Prototypes'
    )
    expect(container.querySelector('[data-message="lead-report"]')?.textContent).toBe('')
    act(() => root.unmount())
  })
})
