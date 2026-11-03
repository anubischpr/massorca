/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/components/sidebar/StatusIndicator', () => ({ default: () => null }))
vi.mock('@/components/ui/button', () => ({ Button: () => null }))
vi.mock('@/components/ui/select', () => ({
  Select: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))

const { BotTeamTaskCard } = await import('./BotTeamTaskCard')

const task: BotTeamTask = {
  id: 'task',
  teamId: 't1',
  title: 'Write the flyer',
  prompt: '',
  ownerBotId: 'b1',
  sessionId: 'session',
  projectId: null
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function render(status: BotTeamTaskStatus): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => {
    root.render(
      <BotTeamTaskCard
        task={task}
        owner={undefined}
        status={status}
        projects={[]}
        offline={false}
        reassign={null}
        onMove={() => {}}
        onStart={() => {}}
        onOpen={() => {}}
      />
    )
  })
  return container
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('a task card while the host has not answered', () => {
  it('shows a placeholder and no status word for an unanswered status', async () => {
    const card = await render('Unknown')

    expect(card.querySelector('[data-bot-team-status-placeholder]')).not.toBeNull()
    expect(card.textContent).not.toContain('Working')
    expect(card.textContent).not.toContain('In Progress')
  })

  it('shows the status word once the status is known', async () => {
    const card = await render('Working')

    expect(card.querySelector('[data-bot-team-status-placeholder]')).toBeNull()
    expect(card.textContent).toContain('Working')
  })
})
