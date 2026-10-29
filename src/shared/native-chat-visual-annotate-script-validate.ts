/**
 * Frame-side validation of host commands: a whole command is kept or dropped.
 * Concatenated into the frame script; it has no meaning on its own.
 */
export const ANNOTATE_FRAME_VALIDATE_SCRIPT = String.raw`
function isText(value, max, min) {
  return typeof value === 'string' && value.length >= min && value.length <= max
}
function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value)
}
function isHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}
// A size as CSS, or null when it is not one of the documented shapes.
function cssSize(size) {
  if (!size || typeof size !== 'object') return null
  if (size.unit === 'auto') return isFiniteNumber(size.value) ? 'auto' : null
  if ((size.unit === 'px' || size.unit === '%') && isFiniteNumber(size.value) && size.value >= 0 && size.value <= L.px) {
    return size.value + size.unit
  }
  return null
}

function readPins(list) {
  if (!Array.isArray(list) || list.length > L.items) return null
  var pins = []
  for (var i = 0; i < list.length; i++) {
    var pin = list[i]
    if (!pin || typeof pin !== 'object') return null
    if (!isText(pin.pinKey, L.pinKey, 1) || !isText(pin.selector, L.selector, 1)) return null
    if (!isFiniteNumber(pin.number) || pin.number < 1 || pin.number > L.pinNumber || Math.floor(pin.number) !== pin.number) return null
    if (typeof pin.active !== 'boolean') return null
    pins.push({ pinKey: pin.pinKey, number: pin.number, selector: pin.selector, active: pin.active })
  }
  return pins
}

function readOverrides(list) {
  if (!Array.isArray(list) || list.length > L.items) return null
  var overrides = []
  for (var i = 0; i < list.length; i++) {
    var item = list[i]
    if (!item || typeof item !== 'object' || !isText(item.selector, L.selector, 1)) return null
    if (item.text !== undefined && !isText(item.text, L.text, 0)) return null
    var declarations = []
    if (item.style !== undefined) {
      var style = item.style
      if (!style || typeof style !== 'object') return null
      if (style.color !== undefined) {
        if (!isHex(style.color)) return null
        declarations.push(['color', style.color])
      }
      if (style.backgroundColor !== undefined) {
        if (!isHex(style.backgroundColor)) return null
        declarations.push(['background-color', style.backgroundColor])
      }
      if (style.width !== undefined) {
        var width = cssSize(style.width)
        if (width === null) return null
        declarations.push(['width', width])
      }
      if (style.height !== undefined) {
        var height = cssSize(style.height)
        if (height === null) return null
        declarations.push(['height', height])
      }
      if (style.fontSize !== undefined) {
        if (!isFiniteNumber(style.fontSize) || style.fontSize < 1 || style.fontSize > L.fontSize) return null
        declarations.push(['font-size', style.fontSize + 'px'])
      }
    }
    overrides.push({ selector: item.selector, text: item.text === undefined ? null : item.text, declarations: declarations })
  }
  return overrides
}

`
