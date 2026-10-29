import {
  buildPrototypeAskCountLine,
  buildPrototypeCountLine,
  type PrototypeCountSetting
} from '../../../src/shared/prototype-count-setting'

/** The line Settings shows: the count as set, or "[your pick]" while each request asks. */
export function mobilePrototypePromptLine(setting: PrototypeCountSetting): string {
  return setting.mode === 'always'
    ? buildPrototypeCountLine(setting.count)
    : buildPrototypeAskCountLine().replace(' N ', ' [your pick] ')
}
