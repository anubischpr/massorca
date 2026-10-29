import { describe, expect, it } from 'vitest'
import { isUsablePrototypeRequestFolder } from './prototype-request'

const ID = '20261028-201500-k3f9q2'

describe('isUsablePrototypeRequestFolder', () => {
  it('accepts a request id and the prototypes folder the host made for it', () => {
    expect(isUsablePrototypeRequestFolder(ID, `/srv/visuals/prototypes/${ID}`)).toBe(true)
    expect(isUsablePrototypeRequestFolder(ID, `D:\\visuals\\prototypes\\${ID}\\`)).toBe(true)
  })

  it('refuses a malformed id, or a folder with no name once its separators are dropped', () => {
    expect(isUsablePrototypeRequestFolder('not a valid id', '/srv/p')).toBe(false)
    expect(isUsablePrototypeRequestFolder(ID, '/')).toBe(false)
    expect(isUsablePrototypeRequestFolder(ID, '   ')).toBe(false)
  })

  it('refuses a folder that is not this request, or that merely looks like its prototypes folder', () => {
    expect(isUsablePrototypeRequestFolder(ID, '/srv/visuals/prototypes/other')).toBe(false)
    expect(isUsablePrototypeRequestFolder(ID, '/srv/visuals')).toBe(false)
    expect(isUsablePrototypeRequestFolder(ID, `/srv/visuals/xprototypes/${ID}`)).toBe(false)
  })
})
