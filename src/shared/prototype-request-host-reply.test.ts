import { describe, expect, it } from 'vitest'
import { isUsablePrototypeRequestFolder } from './prototype-request'

const ID = '20261028-201500-k3f9q2'

describe('isUsablePrototypeRequestFolder', () => {
  it('accepts a request id and a folder the instructions can be written for', () => {
    expect(isUsablePrototypeRequestFolder(ID, '/srv/visuals/prototypes/x')).toBe(true)
    expect(isUsablePrototypeRequestFolder(ID, 'D:\\visuals\\prototypes\\x\\')).toBe(true)
  })

  it('refuses a malformed id, or a folder with no name once its separators are dropped', () => {
    expect(isUsablePrototypeRequestFolder('not a valid id', '/srv/p')).toBe(false)
    expect(isUsablePrototypeRequestFolder(ID, '/')).toBe(false)
    expect(isUsablePrototypeRequestFolder(ID, '   ')).toBe(false)
  })
})
