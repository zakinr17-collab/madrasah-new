// Mobile split-learning popup regression: real controller, simulated pointer events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/learningModule.js', 'utf8');
assert.equal(source, fs.readFileSync('public/learningModule.js', 'utf8'), 'Online/offline module copies must match');
const start = source.indexOf('let learningMobileDockCleanup = null;');
const end = source.indexOf('function openLearningSplitDock(materialId', start);
assert(start > 0 && end > start, 'Mobile dock controller must exist in the actual learning module');
assert(source.includes("data-learning-dock-drag"), 'A visible drag handle must exist');
assert(source.includes('touch-action:none'), 'The handle must opt out of browser touch panning');
assert(source.includes('z-index:40'), 'Mobile reference must stay below anti-cheat dialogs');
assert(!source.includes('padding-bottom:min(49dvh,470px)'), 'Mobile CBT should not be forcibly padded for a fixed dock');
const actualController = source.slice(start, end);

function classes(initial = []) {
  const values = new Set(initial);
  return {
    contains: (name) => values.has(name),
    add: (name) => values.add(name),
    remove: (name) => values.delete(name),
    toggle: (name) => values.has(name) ? (values.delete(name), false) : (values.add(name), true)
  };
}
function emitter() {
  const callbacks = {};
  return {
    addEventListener(type, callback) { (callbacks[type] ||= new Set()).add(callback); },
    removeEventListener(type, callback) { callbacks[type]?.delete(callback); },
    emit(type, event = {}) { for (const callback of callbacks[type] || []) callback(event); },
    listeners(type) { return callbacks[type]?.size || 0; }
  };
}
function fixture(width = 360) {
  const windowEvents = emitter();
  const viewportEvents = emitter();
  const gripEvents = emitter();
  const body = { classList: classes(['learning-split-active']) };
  const grip = { ...gripEvents, setPointerCapture() {}, hasPointerCapture() { return false; } };
  const panelBody = { classList: classes() };
  const toggleButton = { textContent: 'Perkecil materi' };
  const sizeButton = { textContent: 'Perbesar' };
  const attributes = {};
  const style = {};
  let removed = false;
  const dock = {
    style,
    classList: classes(),
    getBoundingClientRect() {
      return {
        left: Number.isFinite(parseFloat(style.left)) ? parseFloat(style.left) : 170,
        top: Number.isFinite(parseFloat(style.top)) ? parseFloat(style.top) : 650,
        width: dock.classList.contains('learning-dock-collapsed') ? 180 : (attributes['data-learning-dock-size'] === 'large' ? 340 : 320),
        height: dock.classList.contains('learning-dock-collapsed') ? 50 : (attributes['data-learning-dock-size'] === 'large' ? 520 : 350)
      };
    },
    getAttribute(name) { return attributes[name] || null; },
    setAttribute(name, value) { attributes[name] = String(value); },
    remove() { removed = true; },
    querySelector(selector) {
      return ({
        '[data-learning-dock-drag]': grip,
        '[data-learning-dock-body]': panelBody,
        '[data-learning-dock-toggle]': toggleButton,
        '[data-learning-dock-size-toggle]': sizeButton
      })[selector] || null;
    }
  };
  const document = {
    body,
    getElementById(id) {
      if (id === 'learning-split-dock') return removed ? null : dock;
      if (id === 'learning-split-dock-style') return { remove() {} };
      return null;
    }
  };
  const win = {
    innerWidth: width,
    innerHeight: 720,
    matchMedia: () => ({ matches: width <= 800 }),
    visualViewport: {
      offsetLeft: 0, offsetTop: 0, width, height: 720,
      addEventListener: viewportEvents.addEventListener,
      removeEventListener: viewportEvents.removeEventListener
    },
    addEventListener: windowEvents.addEventListener,
    removeEventListener: windowEvents.removeEventListener
  };
  const ctx = vm.createContext({ window:win, document });
  vm.runInContext(actualController, ctx);
  return { ctx, win, dock, grip, gripEvents, windowEvents, viewportEvents, panelBody, toggleButton, sizeButton, body, get removed(){ return removed; } };
}

const mobile = fixture(360);
vm.runInContext('setupLearningMobileDock(document.getElementById("learning-split-dock"))', mobile.ctx);
assert(mobile.dock.classList.contains('learning-dock-collapsed'), 'Phone starts with a compact material chip');
assert(mobile.panelBody.classList.contains('hidden'), 'Compact chip must not block CBT answers');
assert.equal(mobile.toggleButton.textContent, 'Buka materi');
assert.equal(mobile.gripEvents.listeners('pointerdown'), 1);
mobile.win.toggleLearningSplitDock();
assert(!mobile.dock.classList.contains('learning-dock-collapsed'), 'Pill opens to floating material panel');
assert(!mobile.panelBody.classList.contains('hidden'));
assert.equal(mobile.body.classList.contains('learning-split-active'), true);
assert(parseFloat(mobile.dock.style.top) <= 362, 'Expanded popup must remain inside phone height');
mobile.gripEvents.emit('pointerdown', { button: 0, pointerId: 11, clientX: 210, clientY: 540, cancelable: true, preventDefault(){} });
mobile.gripEvents.emit('pointermove', { pointerId: 11, clientX: -400, clientY: -400, cancelable: true, preventDefault(){} });
assert(parseFloat(mobile.dock.style.left) >= 8, 'Drag must clamp left edge');
assert(parseFloat(mobile.dock.style.top) >= 8, 'Drag must clamp top edge');
mobile.gripEvents.emit('pointermove', { pointerId: 11, clientX: 1800, clientY: 1800, cancelable: true, preventDefault(){} });
assert(parseFloat(mobile.dock.style.left) <= 32, 'Drag must clamp right edge');
assert(parseFloat(mobile.dock.style.top) <= 362, 'Drag must clamp bottom edge');
mobile.gripEvents.emit('pointerup', { pointerId: 11 });
mobile.win.toggleLearningMobileDockSize();
assert.equal(mobile.dock.getAttribute('data-learning-dock-size'), 'large');
assert.equal(mobile.sizeButton.textContent, 'Perkecil ukuran');
assert(parseFloat(mobile.dock.style.top) <= 192, 'Enlarging must still leave popup on-screen');
mobile.win.toggleLearningSplitDock();
assert(mobile.dock.classList.contains('learning-dock-collapsed'), 'Popup can be minimized again');
mobile.win.closeLearningSplitDock();
assert(mobile.removed, 'Closing removes the companion');
assert.equal(mobile.gripEvents.listeners('pointerdown'), 0, 'Pointer listeners must be cleaned up');
assert.equal(mobile.windowEvents.listeners('resize'), 0, 'Resize listener must be cleaned up');
assert.equal(mobile.viewportEvents.listeners('resize'), 0, 'Visual viewport listener must be cleaned up');

const desktop = fixture(1080);
vm.runInContext('setupLearningMobileDock(document.getElementById("learning-split-dock"))', desktop.ctx);
assert(!desktop.dock.classList.contains('learning-dock-collapsed'), 'Desktop retains visible split reading dock');
assert.equal(desktop.gripEvents.listeners('pointerdown'), 0, 'Desktop does not gain mobile drag behavior');
console.log('PASS: mobile draggable study popup, compact default, expand/resize, bounds, cleanup, desktop parity');
