import { describe, expect, it } from 'vitest'
import {
  AskUserQuestionsInput,
  askUserQuestionFromFlags,
  askUserQuestionItemId,
  askUserRequestIdOfQuestionItem,
  buildAskUserQuestionBody,
  formatAskUserAnswers,
  readAskUserAnswers
} from './agent-ask-user-journal'
import { delegationQuestionItemId } from './delegated-session-journal'
import { parseAskFromToolInput } from './native-chat-ask'

describe('ask-user journal rows', () => {
  it('keys a card so only its own request id reads back from it', () => {
    const itemId = askUserQuestionItemId('req-1')
    expect(askUserRequestIdOfQuestionItem(itemId)).toBe('req-1')
    expect(askUserRequestIdOfQuestionItem(delegationQuestionItemId('req-1'))).toBeNull()
  })

  it('draws one single-select question as a flat card older clients can answer', () => {
    const input = AskUserQuestionsInput.parse({
      questions: [{ question: 'Which color?', options: ['Red', 'Green', 'Blue'] }]
    })
    const body = buildAskUserQuestionBody(input)
    expect(body.question).toBe('Which color?')
    expect(body.options.map((option) => option.label)).toEqual(['Red', 'Green', 'Blue'])
    expect(body.freeTextQuestionId).toBe('q1')
    expect(body.questions?.[0]).toMatchObject({ id: 'q1', multiSelect: false })
    expect(body.resolution.state).toBe('pending')
  })

  it("reads Antigravity's own ask_question shape, is_multi_select included", () => {
    const input = AskUserQuestionsInput.parse({
      questions: [
        { question: 'Colors?', options: ['Red', 'Blue'], is_multi_select: true },
        { question: 'Size?', options: [{ label: 'S', description: 'small' }] }
      ]
    })
    const body = buildAskUserQuestionBody(input)
    expect(body.questions?.map((question) => question.multiSelect)).toEqual([true, false])
    expect(body.questions?.[1]?.options[0]).toEqual({
      id: 'q2:choice-1',
      label: 'S',
      description: 'small'
    })
    expect(body.options).toEqual([])
  })

  it('renders through the same card parser a provider question uses', () => {
    const body = buildAskUserQuestionBody(
      AskUserQuestionsInput.parse([{ question: 'Pick', options: ['A', 'B'] }])
    )
    expect(parseAskFromToolInput(undefined, { questions: body.questions })).toEqual({
      questions: [
        {
          question: 'Pick',
          header: undefined,
          multiSelect: false,
          options: [
            { label: 'A', description: undefined },
            { label: 'B', description: undefined }
          ]
        }
      ]
    })
  })

  it('rejects input the card cannot draw', () => {
    expect(AskUserQuestionsInput.safeParse({ questions: [] }).success).toBe(false)
    expect(
      AskUserQuestionsInput.safeParse({ questions: [{ question: 'x', options: [] }] }).success
    ).toBe(false)
    expect(
      AskUserQuestionsInput.safeParse({
        questions: Array.from({ length: 5 }, () => ({ question: 'x', options: ['a'] }))
      }).success
    ).toBe(false)
  })

  it('formats the answer one line per question, labels then typed text', () => {
    const body = buildAskUserQuestionBody(
      AskUserQuestionsInput.parse([
        { question: 'Colors?', options: ['Red', 'Green', 'Blue'], multiSelect: true },
        { question: 'Why?', options: ['Fun'] },
        { question: 'Skipped?', options: ['Yes'] }
      ])
    )
    const answers = readAskUserAnswers(body.questions ?? [], [
      { questionId: 'q1', optionIds: ['q1:choice-3', 'q1:choice-1'] },
      { questionId: 'q2', optionIds: [], other: '  because  ' }
    ])
    expect(answers).toEqual([
      { question: 'Colors?', selected: ['Red', 'Blue'] },
      { question: 'Why?', selected: [], other: 'because' },
      { question: 'Skipped?', selected: [] }
    ])
    expect(formatAskUserAnswers(answers)).toBe('Red, Blue\nbecause\n')
  })

  it('builds one question from the plain flags, which survive a PowerShell launcher', () => {
    const input = askUserQuestionFromFlags({
      question: ' Elige un color ',
      options: 'rojo, verde ,,azul',
      multiSelect: true
    })
    expect(AskUserQuestionsInput.parse(input)).toEqual({
      questions: [
        { question: 'Elige un color', options: ['rojo', 'verde', 'azul'], multiSelect: true }
      ]
    })
  })
})
