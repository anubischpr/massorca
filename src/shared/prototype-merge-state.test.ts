import { describe, expect, it } from 'vitest'
import { parsePrototypeMergePlan, type PrototypeMergePlan } from './prototype-merge-plan'
import {
  adoptMergedDirection,
  beginMerge,
  beginMergeSend,
  canMerge,
  canSendMerge,
  cancelMerge,
  cancelSentMerge,
  chatTookMerge,
  mergeRefused,
  mergeRequestRefused,
  mergeSent,
  planArrived,
  setMergeBaseline,
  setMergeNote,
  setPartSource,
  togglePart,
  withMergeKept
} from './prototype-merge-state'
import {
  createSetState,
  keepListedLetters,
  makeMain,
  openDirection,
  showFocus,
  showSet,
  toggleStar,
  type PrototypeSetState
} from './prototype-set-state'

const PLAN_JSON = JSON.stringify({
  id: 'plan-1',
  from: ['A', 'C'],
  parts: [
    { name: 'Heading', selector: 'main > h1', from: 'A' },
    { name: 'Pay button', selector: 'button.cta', from: 'C' }
  ]
})

function plan(): PrototypeMergePlan {
  const result = parsePrototypeMergePlan(PLAN_JSON)
  if (result === null) {
    throw new Error('expected a valid plan')
  }
  return result
}

function starred(...letters: string[]): PrototypeSetState {
  return letters.reduce(toggleStar, createSetState(['A', 'B', 'C']))
}

function waiting(): PrototypeSetState {
  return beginMerge(starred('A', 'C'), { planId: 'plan-1', baseline: null })
}

function reviewing(): PrototypeSetState {
  return planArrived(waiting(), plan(), PLAN_JSON)
}

describe('starting a merge', () => {
  it('needs two stars, no merge under way and a free letter', () => {
    expect(canMerge(starred('A'), 'D')).toBe(false)
    expect(canMerge(starred('A', 'C'), 'D')).toBe(true)
    expect(canMerge(starred('A', 'C'), null)).toBe(false)
    expect(canMerge(waiting(), 'D')).toBe(false)
  })

  it('waits for the plan with the starred directions, on the focus layout', () => {
    const state = beginMerge(showSet(starred('A', 'C')), { planId: 'plan-1', baseline: 'old' })
    expect(state.layout).toBe('focus')
    expect(state.merge).toEqual({
      phase: 'waiting',
      letters: ['A', 'C'],
      planId: 'plan-1',
      baseline: 'old',
      layoutBefore: 'set'
    })
  })

  it('refuses below two stars and while another merge is under way', () => {
    const one = starred('A')
    expect(beginMerge(one, { planId: 'p', baseline: null })).toBe(one)
    const under = waiting()
    expect(beginMerge(under, { planId: 'other', baseline: null })).toBe(under)
  })

  it('ends the wait, keeping the stars, when the chat refuses the request', () => {
    const state = mergeRequestRefused(waiting())
    expect(state.merge).toBeNull()
    expect(state.mergeSendFailed).toBe(true)
    expect(state.starred).toEqual(['A', 'C'])
  })
})

describe('the suggestion request', () => {
  it('shows the wait from the click, before the plan file is read', () => {
    const state = beginMerge(starred('A', 'C'), { planId: 'plan-1' })
    expect(state.merge).toMatchObject({ phase: 'waiting', letters: ['A', 'C'], planId: 'plan-1' })
    expect(state.merge?.phase === 'waiting' && state.merge.baseline).toBeUndefined()
  })

  it('takes no plan until the baseline is read, then the plan answers the request', () => {
    const unread = beginMerge(starred('A', 'C'), { planId: 'plan-1' })
    expect(planArrived(unread, plan(), PLAN_JSON)).toBe(unread)
    const requested = setMergeBaseline(unread, 'plan-1', null)
    expect(requested.merge).toMatchObject({ phase: 'waiting', baseline: null })
    expect(planArrived(requested, plan(), PLAN_JSON).merge?.phase).toBe('review')
  })

  it('reads the baseline once, and only for the merge that is waiting', () => {
    const unread = beginMerge(starred('A', 'C'), { planId: 'plan-1' })
    expect(setMergeBaseline(unread, 'other', 'old')).toBe(unread)
    const read = setMergeBaseline(unread, 'plan-1', 'old')
    expect(read.merge).toMatchObject({ baseline: 'old' })
    expect(setMergeBaseline(read, 'plan-1', 'newer')).toBe(read)
    expect(setMergeBaseline(cancelMerge(unread), 'plan-1', 'old').merge).toBeNull()
  })
})

describe('the plan arriving', () => {
  it('opens the review with every part kept from the suggested source', () => {
    const state = reviewing()
    expect(state.merge).toMatchObject({
      phase: 'review',
      letters: ['A', 'C'],
      note: '',
      sending: false
    })
    expect(state.merge?.phase === 'review' && state.merge.parts.map((part) => part.from)).toEqual([
      'A',
      'C'
    ])
  })

  it('ignores a plan for other directions or with another id', () => {
    const waitingState = waiting()
    const other = parsePrototypeMergePlan(JSON.stringify({ ...plan(), id: 'old' }))
    if (other === null) {
      throw new Error('expected a valid plan')
    }
    expect(planArrived(waitingState, other, '{}')).toBe(waitingState)
    const wrongLetters = { ...plan(), id: undefined, from: ['A', 'B'] }
    expect(planArrived(waitingState, wrongLetters, '{}')).toBe(waitingState)
  })

  it('is ignored when no merge waits for it', () => {
    const idle = starred('A', 'C')
    expect(planArrived(idle, plan(), PLAN_JSON)).toBe(idle)
  })
})

describe('the review', () => {
  it('switches the source of a part to another starred letter only', () => {
    const state = setPartSource(reviewing(), 0, 'C')
    expect(state.merge?.phase === 'review' && state.merge.parts[0]?.from).toBe('C')
    const unchanged = reviewing()
    expect(setPartSource(unchanged, 0, 'B')).toBe(unchanged)
  })

  it('keeps a part present in one direction on that source', () => {
    const json = JSON.stringify({
      id: 'plan-1',
      from: ['A', 'C'],
      parts: [{ name: 'Timeline', kind: 'section', selectors: { C: '.timeline' }, from: 'C' }]
    })
    const parsedPlan = parsePrototypeMergePlan(json)
    if (parsedPlan === null) {
      throw new Error('expected a valid plan')
    }
    const state = planArrived(waiting(), parsedPlan, json)
    expect(setPartSource(state, 0, 'A')).toBe(state)
  })

  it('leaves a part out and takes it back in', () => {
    const out = togglePart(reviewing(), 1)
    expect(out.merge?.phase === 'review' && out.merge.parts[1]?.on).toBe(false)
    const back = togglePart(out, 1)
    expect(back.merge?.phase === 'review' && back.merge.parts[1]?.on).toBe(true)
  })

  it('keeps the free text, and cancel ends the merge but keeps the stars', () => {
    const noted = setMergeNote(reviewing(), 'Keep the heading small')
    expect(noted.merge?.phase === 'review' && noted.merge.note).toBe('Keep the heading small')
    const cancelled = cancelMerge(noted)
    expect(cancelled.merge).toBeNull()
    expect(cancelled.starred).toEqual(['A', 'C'])
  })

  it('can be sent while a part is kept and no send is in flight', () => {
    expect(canSendMerge(reviewing())).toBe(true)
    expect(canSendMerge(togglePart(togglePart(reviewing(), 0), 1))).toBe(false)
    expect(canSendMerge(beginMergeSend(reviewing()))).toBe(false)
    expect(canSendMerge(waiting())).toBe(false)
  })
})

describe('sending the merge', () => {
  it('closes the review and waits for the merged direction, showing what was sent', () => {
    const state = mergeSent(beginMergeSend(reviewing()), {
      letter: 'D',
      visibleMessage: 'Merge into D.'
    })
    expect(state.merge).toBeNull()
    expect(state.mergeInto).toEqual({ letter: 'D', from: ['A', 'C'] })
    expect(state.sentMessage).toBe('Merge into D.')
    expect(state.starred).toEqual(['A', 'C'])
  })

  it('keeps the review and shows the failure line when the chat refuses', () => {
    const state = mergeRefused(beginMergeSend(reviewing()))
    expect(state.mergeSendFailed).toBe(true)
    expect(state.merge).toMatchObject({ phase: 'review', sending: false })
    expect(canSendMerge(state)).toBe(true)
  })

  it('lands back on the layout the merge started from, so View all shows the directions again', () => {
    const fromSet = planArrived(
      beginMerge(showSet(starred('A', 'C')), { planId: 'plan-1', baseline: null }),
      plan(),
      PLAN_JSON
    )
    const sent = mergeSent(beginMergeSend(fromSet), {
      letter: 'D',
      visibleMessage: 'Merge into D.'
    })
    expect(sent.layout).toBe('set')
    const fromFocus = mergeSent(beginMergeSend(reviewing()), {
      letter: 'D',
      visibleMessage: 'Merge into D.'
    })
    expect(fromFocus.layout).toBe('focus')
  })

  it('lands back on View all after a second merge sent from there too', () => {
    const adopted = adoptMergedDirection(
      mergeSent(reviewing(), { letter: 'D', visibleMessage: 'Merge into D.' }),
      ['A', 'B', 'C', 'D']
    )
    const secondText = JSON.stringify({
      id: 'plan-2',
      from: ['A', 'D'],
      parts: [{ name: 'Hero', selector: 'section.hero', from: 'D' }]
    })
    const secondPlan = parsePrototypeMergePlan(secondText)
    if (secondPlan === null) {
      throw new Error('expected a valid plan')
    }
    const started = beginMerge(showSet(toggleStar(toggleStar(adopted, 'A'), 'D')), {
      planId: 'plan-2',
      baseline: null
    })
    const second = mergeSent(beginMergeSend(planArrived(started, secondPlan, secondText)), {
      letter: 'E',
      visibleMessage: 'Merge into E.'
    })
    expect(second).toMatchObject({ layout: 'set', mergeInto: { letter: 'E', from: ['A', 'D'] } })
  })

  it('ends the wait for a sent merge from its row and keeps the stars', () => {
    const sent = mergeSent(reviewing(), { letter: 'D', visibleMessage: 'Merge into D.' })
    const cancelled = cancelSentMerge(sent)
    expect(cancelled.mergeInto).toBeNull()
    expect(cancelled.starred).toEqual(['A', 'C'])
    expect(cancelSentMerge(cancelled)).toBe(cancelled)
  })

  it('lets the user ask again while the merged direction has not shown up', () => {
    const sent = mergeSent(reviewing(), { letter: 'D', visibleMessage: 'Merge into D.' })
    expect(canMerge(sent, 'D')).toBe(true)
  })
})

describe('the merged direction joining the set', () => {
  function sentState(): PrototypeSetState {
    return mergeSent(reviewing(), { letter: 'D', visibleMessage: 'Merge into D.' })
  }

  it('becomes the main on screen, clears the stars and remembers its parents', () => {
    const state = adoptMergedDirection(sentState(), ['A', 'B', 'C', 'D'])
    expect(state).toMatchObject({
      active: 'D',
      view: 'D',
      layout: 'focus',
      starred: [],
      mergeInto: null,
      mergedFrom: { D: ['A', 'C'] }
    })
  })

  it('waits while the set does not list it yet', () => {
    const state = sentState()
    expect(adoptMergedDirection(state, ['A', 'B', 'C'])).toBe(state)
  })

  it('leaves the old main read-only with its own state, and the stars cleared for a new merge', () => {
    const state = adoptMergedDirection(sentState(), ['A', 'B', 'C', 'D'])
    expect(makeMain(openDirection(state, 'B')).mergedFrom).toEqual({ D: ['A', 'C'] })
    expect(canMerge(toggleStar(toggleStar(state, 'A'), 'B'), 'E')).toBe(true)
  })

  it('does nothing when no merge was sent', () => {
    const idle = starred('A', 'C')
    expect(adoptMergedDirection(idle, ['A', 'B', 'C', 'D'])).toBe(idle)
  })
})

describe('leaving the merge', () => {
  it('ends a merge that waits or is under review when the user navigates away', () => {
    for (const leave of [
      (state: PrototypeSetState) => openDirection(state, 'B'),
      (state: PrototypeSetState) => showSet(state),
      (state: PrototypeSetState) => showFocus(state),
      (state: PrototypeSetState) => makeMain(state),
      (state: PrototypeSetState) => toggleStar(state, 'B')
    ]) {
      expect(leave(waiting()).merge).toBeNull()
      expect(leave(reviewing()).merge).toBeNull()
    }
  })

  it('ends when a starred direction leaves the set', () => {
    expect(keepListedLetters(waiting(), ['A', 'B']).merge).toBeNull()
    expect(keepListedLetters(waiting(), ['A', 'B', 'C']).merge).not.toBeNull()
  })
})

describe('the Layout toggle', () => {
  it('keeps a merge under way and a sent one through View all and Design main', () => {
    const waitingState = waiting()
    const inSet = withMergeKept(waitingState, showSet)
    expect(inSet).toMatchObject({ layout: 'set', merge: waitingState.merge })
    expect(withMergeKept(inSet, showFocus)).toMatchObject({
      layout: 'focus',
      merge: waitingState.merge
    })
    const reviewState = reviewing()
    expect(withMergeKept(reviewState, showSet).merge).toEqual(reviewState.merge)
    const sent = mergeSent(reviewing(), { letter: 'D', visibleMessage: 'Merge into D.' })
    expect(withMergeKept(sent, showSet)).toMatchObject({
      layout: 'set',
      mergeInto: { letter: 'D', from: ['A', 'C'] }
    })
  })
})

describe('a merge message the chat is asked to take', () => {
  it('is taken when the chat takes it, and refused when it declines it', async () => {
    await expect(chatTookMerge(async () => true)).resolves.toBe(true)
    await expect(chatTookMerge(async () => false)).resolves.toBe(false)
  })

  it('is refused when the send throws, so the review stays to be sent again', async () => {
    await expect(chatTookMerge(() => Promise.reject(new Error('lost')))).resolves.toBe(false)
  })
})
