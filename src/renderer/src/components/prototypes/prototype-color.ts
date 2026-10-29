// Color values of the Edit controls: the two fixed palettes per role and the custom picker's grid.

export const TEXT_COLOR_PALETTE = ['#171717', '#ffffff'] as const
export const FILL_COLOR_PALETTE = ['#171717', '#f5f5f5'] as const

/** The picker's hues, in degrees. */
export const PICKER_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const

const CHANNEL_HEX = (value: number): string =>
  Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')

/** An HSL color as a hex string: saturation and lightness in percent. */
export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  return `#${CHANNEL_HEX(channel(0))}${CHANNEL_HEX(channel(8))}${CHANNEL_HEX(channel(4))}`
}

/** The 24 shade cells for one hue: two saturated rows, a muted row, and greys. */
export function pickerShadeCells(hue: number): string[] {
  const cells: string[] = []
  for (const saturation of [90, 65]) {
    for (const lightness of [20, 32, 44, 56, 68, 80]) {
      cells.push(hslToHex(hue, saturation, lightness))
    }
  }
  for (const lightness of [30, 45, 60, 75, 88, 95]) {
    cells.push(hslToHex(hue, 35, lightness))
  }
  for (const lightness of [10, 28, 46, 64, 82, 100]) {
    cells.push(hslToHex(0, 0, lightness))
  }
  return cells
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/u

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value)
}
