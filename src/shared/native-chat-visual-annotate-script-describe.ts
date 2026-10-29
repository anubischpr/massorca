/**
 * Frame-side description of a picked element: stable selector, label, state and snippet.
 * Concatenated into the frame script; it has no meaning on its own.
 */
export const ANNOTATE_FRAME_DESCRIBE_SCRIPT = String.raw`
function selectorFor(element) {
  if (element === root) return 'html'
  var parts = []
  for (var node = element; node && node !== root; node = node.parentElement) {
    if (node.id && ID.test(node.id) && document.querySelectorAll('#' + node.id).length === 1) {
      parts.unshift('#' + node.id)
      return parts.join(' > ')
    }
    parts.unshift(node.localName + ':nth-of-type(' + typeIndex(node) + ')')
  }
  parts.unshift('html')
  return parts.join(' > ')
}

function typeIndex(node) {
  var index = 1
  for (var sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (sibling.localName === node.localName) index++
  }
  return index
}

function labelFor(element) {
  var aria = element.getAttribute('aria-label')
  var source = aria && aria.trim() ? aria : element.textContent || ''
  var label = source.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 24).trim()
  return label || element.localName
}

function directText(element) {
  var out = ''
  for (var node = element.firstChild; node; node = node.nextSibling) if (node.nodeType === 3) out += node.nodeValue
  return out.trim().slice(0, L.text)
}

function parseRgbText(text) {
  var match = RGB.exec(text)
  if (match) return { r: +match[1], g: +match[2], b: +match[3], a: match[4] === undefined ? 1 : +match[4] }
  match = HEX.exec(text)
  return match ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16), a: 1 } : null
}

// rgb()/rgba() parse directly; any other syntax (oklch, color-mix) is normalised by a canvas.
function parseColor(value) {
  var parsed = parseRgbText(value)
  if (parsed) return parsed
  try {
    var context = document.createElement('canvas').getContext('2d')
    if (!context) return null
    context.fillStyle = value
    return parseRgbText(String(context.fillStyle))
  } catch (_) {
    return null
  }
}

function toHex(color) {
  return '#' + [color.r, color.g, color.b].map(function (channel) {
    var value = Math.max(0, Math.min(255, Math.round(channel)))
    return (value < 16 ? '0' : '') + value.toString(16)
  }).join('')
}

// A transparent element shows its nearest painted ancestor, so the fill matches what is on screen.
function fillOf(element) {
  for (var node = element; node && node.nodeType === 1; node = node.parentElement) {
    var color = parseColor(window.getComputedStyle(node).backgroundColor)
    if (color && color.a > 0) return toHex(color)
  }
  return '#ffffff'
}

function pixels(value, fallback, max) {
  var number = parseFloat(value)
  return Math.min(max, Math.max(0, Math.round(isFinite(number) ? number : fallback)))
}

function stateOf(element, rect) {
  var style = window.getComputedStyle(element)
  var color = parseColor(style.color)
  return {
    text: directText(element),
    color: color ? toHex(color) : '#000000',
    bg: fillOf(element),
    width: { value: pixels(style.width, rect.width, L.px), unit: 'px' },
    height: { value: pixels(style.height, rect.height, L.px), unit: 'px' },
    fontSize: pixels(style.fontSize, 0, L.fontSize)
  }
}

function describeElement(element) {
  var rect = element.getBoundingClientRect()
  return {
    selector: selectorFor(element),
    label: labelFor(element),
    rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    htmlSnippet: String(element.outerHTML || '').slice(0, L.snippet),
    state: stateOf(element, rect)
  }
}

`
