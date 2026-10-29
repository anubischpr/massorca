import {
  NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS,
  NATIVE_CHAT_VISUAL_ANNOTATE_TYPE,
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
  NATIVE_CHAT_VISUAL_PINS_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE
} from './native-chat-visual-annotate'
import { ANNOTATE_FRAME_VALIDATE_SCRIPT } from './native-chat-visual-annotate-script-validate'
import { ANNOTATE_FRAME_PAGE_SCRIPT } from './native-chat-visual-annotate-script-page'
import { ANNOTATE_FRAME_DESCRIBE_SCRIPT } from './native-chat-visual-annotate-script-describe'

/**
 * The frame side of the annotate channel, present only in documents built with `annotate: true`.
 * Plain ES5 like the shell, so it runs independent of the visual. Every host command is checked
 * here before it touches the page: an invalid command is dropped whole, and a selector only ever
 * reaches `querySelector` inside a try block. Host strings are never evaluated.
 */
export function nativeChatVisualAnnotateScript(channel: string): string {
  const constants = JSON.stringify({
    channel,
    annotate: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE,
    pins: NATIVE_CHAT_VISUAL_PINS_TYPE,
    overrides: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
    picked: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
    pinClicked: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
    limits: NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS
  })
  return String.raw`(function () {
'use strict'
var C = ${constants}
var L = C.limits
var host = window.parent
var root = document.documentElement
var enabled = false
var overlay = null
var hover = null
var hovered = null
var badges = []
var outlines = []
var applied = []
var scheduled = false
var BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'dblclick']
// Touch only stops page handlers: cancelling it would also cancel the tap's click, which picks.
var TOUCHED = ['touchstart', 'touchmove', 'touchend']
var ID = /^[A-Za-z][A-Za-z0-9_-]*$/
var RGB = /^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)$/
var HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
var BADGE = 'position:fixed;box-sizing:border-box;width:24px;height:24px;border-radius:50%;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;line-height:1;cursor:pointer;pointer-events:auto;'
var BADGE_ACTIVE = 'background:#3b82f6;color:#ffffff;'
var BADGE_IDLE = 'background:#171717;color:#fafafa;'
var BLUE_OUTLINE = 'outline:2px solid #3b82f6;'

function send(message) {
  message.channel = C.channel
  try { host.postMessage(message, '*') } catch (_) {}
}

${ANNOTATE_FRAME_VALIDATE_SCRIPT}
${ANNOTATE_FRAME_PAGE_SCRIPT}
${ANNOTATE_FRAME_DESCRIBE_SCRIPT}
function onPointerEvent(event) {
  if (!enabled || isOverlay(event.target)) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

function onTouch(event) {
  if (!enabled || isOverlay(event.target)) return
  event.stopImmediatePropagation()
}

function onClick(event) {
  if (!enabled || isOverlay(event.target)) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (!event.target || event.target.nodeType !== 1) return
  var element = describeElement(pickTargetOf(event.target))
  if (element) send({ type: C.picked, element: element })
}

// Moves only record the target; the layout runs once per frame.
function onMove(event) {
  if (!enabled || !event.target || event.target.nodeType !== 1 || isOverlay(event.target)) return
  hovered = pickTargetOf(event.target)
  schedule()
}

function onLeave() {
  hovered = null
  schedule()
}

function setEnabled(on) {
  if (on === enabled) return
  enabled = on
  var listen = on ? 'addEventListener' : 'removeEventListener'
  window[listen]('click', onClick, true)
  for (var i = 0; i < BLOCKED.length; i++) window[listen](BLOCKED[i], onPointerEvent, true)
  for (var j = 0; j < TOUCHED.length; j++) window[listen](TOUCHED[j], onTouch, true)
  document[listen]('mousemove', onMove, true)
  root[listen]('mouseleave', onLeave)
  if (on) ensureOverlay()
  else {
    hovered = null
    layout()
  }
}

window.addEventListener('message', function (event) {
  var data = event.data
  if (event.source !== host || !data || typeof data !== 'object' || data.channel !== C.channel) return
  if (data.type === C.annotate) {
    if (typeof data.enabled === 'boolean') setEnabled(data.enabled)
    return
  }
  if (data.type === C.pins) {
    var pins = readPins(data.pins)
    if (pins) setPins(pins)
    return
  }
  if (data.type === C.overrides) {
    var overrides = readOverrides(data.overrides)
    if (overrides) applyOverrides(overrides)
  }
})
window.addEventListener('resize', schedule)
window.addEventListener('scroll', schedule, true)
})()`
}
