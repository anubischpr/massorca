import { describe, expect, it } from 'vitest'
import {
  DESIGN_SYSTEM_READ_INSTRUCTION,
  DESIGN_SYSTEM_REDETECT_INSTRUCTION,
  designSystemFormatInstruction,
  designSystemReadInstruction,
  designSystemRequestInstruction
} from './prototype-design-system-instruction'
import { buildPrototypeRequestMessage } from './prototype-request'

const MISSING_BRANCH_END = 'write the three files, and stop.'
const FIRST_REQUEST_STEPS =
  'derive tokens from the project (CSS variables, theme or Tailwind config, style guide docs, existing components), list each source, write the three files, and stop.'
const REUSE = 'If they exist, reuse them as they are: never regenerate, rewrite or reformat them.'
const ADD_ONLY_WHAT_IS_MISSING =
  'If a direction needs a token or component the system lacks, add only that one, keep every existing token, value and component unchanged, bump the version with a history entry, and note the addition in system.md.'

describe('DESIGN_SYSTEM_READ_INSTRUCTION', () => {
  it.each([REUSE, ADD_ONLY_WHAT_IS_MISSING])('says %j', (sentence) => {
    expect(DESIGN_SYSTEM_READ_INSTRUCTION).toContain(sentence)
  })

  it('reuses an existing system right after the branch that builds a missing one', () => {
    const text = DESIGN_SYSTEM_READ_INSTRUCTION
    expect(text.indexOf(MISSING_BRANCH_END)).toBeLessThan(text.indexOf(REUSE))
    expect(text.indexOf(REUSE)).toBeLessThan(text.indexOf(ADD_ONLY_WHAT_IS_MISSING))
    expect(text.indexOf(ADD_ONLY_WHAT_IS_MISSING)).toBeLessThan(
      text.indexOf('If the project has no identity')
    )
  })
})

describe('DESIGN_SYSTEM_REDETECT_INSTRUCTION', () => {
  it('spells out the first-request steps for missing files, as the first read does', () => {
    expect(DESIGN_SYSTEM_REDETECT_INSTRUCTION).toContain(
      `If the files are missing, ${FIRST_REQUEST_STEPS}`
    )
    expect(DESIGN_SYSTEM_READ_INSTRUCTION).toContain(`If they are missing: ${FIRST_REQUEST_STEPS}`)
    expect(DESIGN_SYSTEM_REDETECT_INSTRUCTION).not.toContain('as for a first request')
  })

  it('checks which design files exist, and reads only those, before it re-reads them', () => {
    expect(DESIGN_SYSTEM_REDETECT_INSTRUCTION).toContain('Check which of those files exist first')
    expect(DESIGN_SYSTEM_REDETECT_INSTRUCTION).toContain('read only the ones that exist')
  })
})

describe('a prototype request that uses the design system', () => {
  const request = buildPrototypeRequestMessage({
    text: 'a prototype of a login',
    agent: 'claude',
    count: 2,
    requestId: '20261028-201500-k3f9q2',
    folderPath: '/state/visuals/prototypes/20261028-201500-k3f9q2',
    designSystem: 'use'
  })

  it.each([REUSE, ADD_ONLY_WHAT_IS_MISSING])(
    'sends %j, and the chat never shows it',
    (sentence) => {
      expect(request.sentText).toContain(sentence)
      expect(request.visibleText).not.toContain(sentence)
    }
  )
})

describe('designSystemReadInstruction', () => {
  const REPORT =
    'Start your visible reply with one line saying whether the design system was reused'

  it('asks for the reused-or-created line in every mode', () => {
    expect(designSystemReadInstruction()).toContain(REPORT)
    expect(designSystemReadInstruction({ unattended: true })).toContain(REPORT)
  })

  it('asks an unattended child to open its worker_done report with the same statement', () => {
    expect(designSystemReadInstruction({ unattended: true })).toContain(
      'Begin the --body of your worker_done report with that same statement.'
    )
    expect(designSystemReadInstruction()).not.toContain('worker_done')
  })

  it('names project-relative paths without a folder, and checks them before reading', () => {
    expect(DESIGN_SYSTEM_READ_INSTRUCTION).toContain(
      'check whether design/system/tokens.json, components.html and system.md exist'
    )
    expect(DESIGN_SYSTEM_READ_INSTRUCTION).toContain('read a file only when it exists')
  })

  it('names the files under the absolute folder when given one', () => {
    const folder = '/repo/design/system'
    const text = designSystemRequestInstruction({ folder })
    expect(text).toContain(
      `check whether ${folder}/tokens.json, ${folder}/components.html and ${folder}/system.md exist`
    )
    expect(text).toContain(`${folder}/tokens.json: W3C design tokens`)
    expect(text).not.toContain('read design/system/tokens.json')
    expect(text).not.toContain('\ndesign/system/')
  })

  it('does not double the separator of a folder that ends with one', () => {
    expect(designSystemFormatInstruction('C:\\repo\\design\\system\\')).toContain(
      'C:\\repo\\design\\system/tokens.json:'
    )
  })

  it('stops for review by default, and carries on to the directions when nobody reviews', () => {
    expect(designSystemReadInstruction()).toContain('write the three files, and stop.')
    expect(designSystemReadInstruction()).toContain('stop for review')
    const unattended = designSystemReadInstruction({ unattended: true })
    expect(unattended).toContain('and then go on to write the directions')
    expect(unattended).toContain('do not stop')
    expect(unattended).not.toContain('stop for review')
    expect(unattended).not.toContain('propose a system with 2 palette options')
  })

  it('reaches a prototype request with the folder and the unattended flag', () => {
    const request = buildPrototypeRequestMessage({
      text: 'a prototype of a login',
      agent: 'claude',
      count: 1,
      requestId: '20261028-201500-k3f9q2',
      folderPath: '/state/visuals/prototypes/20261028-201500-k3f9q2',
      designSystem: 'use',
      designSystemFolder: '/main/design/system',
      designSystemUnattended: true
    })
    expect(request.sentText).toContain('/main/design/system/tokens.json')
    expect(request.sentText).toContain('do not stop')
    expect(request.visibleText).not.toContain('/main/design/system')
  })
})
