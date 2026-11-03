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
    scope?.sessionId === 's-1' ? [{ requestId: 'req-1', name: 'Launch flyer' }] : []
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
const task = (id: string, sessionId: string | null, createdAt: number): BotTeamRoomReportTask => ({
  id,
  teamId: 't1',
  ownerBotId: 'b1',
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
})
