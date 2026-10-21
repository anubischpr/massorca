import { afterEach, describe, expect, it } from 'vitest'
import {
  closeGentleShellTurnRigs,
  openGentleShellTurnRig
} from './rpc-gentle-shell-test-support'

afterEach(closeGentleShellTurnRigs)

const handled = { type: 'response', command: 'prompt', success: true, data: { disposition: 'handled' } }

async function runCommand(command: string, notices: Record<string, unknown>[]) {
  const h = await openGentleShellTurnRig()
  await h.turns.submit('send-1', 100, { type: 'prompt', message: command })
  for (const notice of notices) {
    h.turns.notices.receive({ type: 'extension_ui_request', id: 'n', method: 'notify', ...notice })
  }
  h.turns.receive(handled)
  await h.flush()
  return (await h.rig.rows()).flatMap((row) => (row.body.kind === 'status' ? [row.body] : []))
}

describe('Pi notify output', () => {
  it('shows what a slash command printed, in order, with its severity', async () => {
    const rows = await runCommand('/gentle:doctor', [
      { message: 'line one\nline two', notifyType: 'info' },
      { message: 'careful', notifyType: 'warning' }
    ])
    expect(rows).toMatchObject([
      { tone: 'notice', text: 'line one\nline two' },
      { tone: 'warning', text: 'careful' }
    ])
  })

  it('explains a terminal-only panel that printed nothing', async () => {
    const rows = await runCommand('/gentle:usage', [])
    expect(rows).toMatchObject([{ tone: 'notice', text: expect.stringContaining('/gentle:usage') }])
  })

  it('does not add the explanation when the panel command printed its own words', async () => {
    const rows = await runCommand('/gentle:changes', [{ message: 'No uncommitted changes' }])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ text: 'No uncommitted changes' })
  })

  it('stays silent for an ordinary command and for a notice outside any prompt', async () => {
    expect(await runCommand('/gentle:mode', [])).toEqual([])
    const h = await openGentleShellTurnRig()
    h.turns.notices.receive({ type: 'extension_ui_request', id: 'n', method: 'notify', message: 'startup' })
    await h.flush()
    expect(await h.rig.rows()).toEqual([])
  })
})
