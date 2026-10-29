/**
 * Frame-side page layer: the overlay, pin badges and outlines, hover, and live overrides.
 * Concatenated into the frame script; it has no meaning on its own.
 */
export const ANNOTATE_FRAME_PAGE_SCRIPT = String.raw`
function queryOne(selector) {
  try { return document.querySelector(selector) } catch (_) { return null }
}

function ensureOverlay() {
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.setAttribute('data-orca-annotate', '')
    overlay.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;margin:0;padding:0;pointer-events:none;z-index:2147483647'
  }
  // Under <html>, not <body>: the page's own body selectors and height never see the overlay.
  if (overlay.parentNode !== root) root.appendChild(overlay)
  if (!hover) {
    hover = document.createElement('div')
    hover.style.cssText = 'position:fixed;pointer-events:none;display:none;' + BLUE_OUTLINE + 'outline-offset:0;'
    overlay.appendChild(hover)
  }
}

function isOverlay(node) {
  return !!overlay && !!node && overlay.contains(node)
}

function placeBox(element, target) {
  var rect = target.getBoundingClientRect()
  element.style.left = rect.left + 'px'
  element.style.top = rect.top + 'px'
  element.style.width = rect.width + 'px'
  element.style.height = rect.height + 'px'
}

// Badges sit at the element's top-left corner; outlines draw 3px outside the element.
function layout() {
  scheduled = false
  for (var i = 0; i < badges.length; i++) {
    var rect = badges[i].target.getBoundingClientRect()
    badges[i].element.style.left = rect.left + 'px'
    badges[i].element.style.top = rect.top + 'px'
  }
  for (var j = 0; j < outlines.length; j++) placeBox(outlines[j].element, outlines[j].target)
  if (hover) {
    if (hovered) {
      placeBox(hover, hovered)
      hover.style.display = 'block'
    } else {
      hover.style.display = 'none'
    }
  }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(layout)
  else setTimeout(layout, 16)
}

function clearPins() {
  for (var i = 0; i < badges.length; i++) if (badges[i].element.parentNode) badges[i].element.parentNode.removeChild(badges[i].element)
  for (var j = 0; j < outlines.length; j++) if (outlines[j].element.parentNode) outlines[j].element.parentNode.removeChild(outlines[j].element)
  badges = []
  outlines = []
}

function pinClickHandler(pinKey) {
  return function (event) {
    event.preventDefault()
    event.stopPropagation()
    send({ type: C.pinClicked, pinKey: pinKey })
  }
}

function setPins(pins) {
  clearPins()
  if (pins.length === 0) return
  ensureOverlay()
  for (var i = 0; i < pins.length; i++) {
    var pin = pins[i]
    var target = queryOne(pin.selector)
    if (!target) continue
    if (pin.active) {
      var outline = document.createElement('div')
      outline.style.cssText = 'position:fixed;pointer-events:none;' + BLUE_OUTLINE + 'outline-offset:3px;'
      overlay.appendChild(outline)
      outlines.push({ element: outline, target: target })
    }
    var badge = document.createElement('div')
    badge.style.cssText = BADGE + (pin.active ? BADGE_ACTIVE : BADGE_IDLE)
    badge.textContent = String(pin.number)
    badge.addEventListener('click', pinClickHandler(pin.pinKey))
    overlay.appendChild(badge)
    badges.push({ element: badge, target: target })
  }
  layout()
}

function setStyle(entry, name, value) {
  entry.props.push({ name: name, value: entry.target.style.getPropertyValue(name), priority: entry.target.style.getPropertyPriority(name) })
  entry.target.style.setProperty(name, value)
}

function setText(entry, text) {
  var owner = textOwnerOf(entry.target)
  var nodes = []
  for (var node = owner.firstChild; node; node = node.nextSibling) if (node.nodeType === 3) nodes.push(node)
  if (nodes.length === 0) {
    entry.added = document.createTextNode(text)
    owner.appendChild(entry.added)
    return
  }
  for (var i = 0; i < nodes.length; i++) {
    entry.texts.push({ node: nodes[i], value: nodes[i].nodeValue })
    nodes[i].nodeValue = i === 0 ? text : ''
  }
}

function restoreEntry(entry) {
  for (var i = entry.texts.length - 1; i >= 0; i--) entry.texts[i].node.nodeValue = entry.texts[i].value
  if (entry.added && entry.added.parentNode) entry.added.parentNode.removeChild(entry.added)
  for (var j = entry.props.length - 1; j >= 0; j--) {
    var prop = entry.props[j]
    if (prop.value === '') entry.target.style.removeProperty(prop.name)
    else entry.target.style.setProperty(prop.name, prop.value, prop.priority)
  }
}

function restoreOverrides() {
  while (applied.length > 0) restoreEntry(applied.pop())
}

// Replaces the whole set: the previous one is restored first, so a removed override restores.
function applyOverrides(overrides) {
  restoreOverrides()
  for (var i = 0; i < overrides.length; i++) {
    var target = queryOne(overrides[i].selector)
    if (!target) continue
    var entry = { target: target, props: [], texts: [], added: null }
    applied.push(entry)
    for (var j = 0; j < overrides[i].declarations.length; j++) setStyle(entry, overrides[i].declarations[j][0], overrides[i].declarations[j][1])
    if (overrides[i].text !== null) setText(entry, overrides[i].text)
  }
  layout()
}

`
