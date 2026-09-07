import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../catalog-pickup.js', import.meta.url), 'utf8');
function setup(seen = false) {
  const elements = [], handlers = {};
  function element() {
    const node = { dataset: {}, events: {}, hidden: false, setAttribute() {},
      addEventListener(type, fn) { this.events[type] = fn; },
      append(child) { child.parentElement = this; }, before() {}, after(child) { child.parentElement = this; }, contains() { return false; } };
    elements.push(node); return node;
  }
  const card = element(), body = element();
  body.classList = { contains: name => state.classes.has(name) };
  const state = { classes: new Set(), busy: false, now: 0, stored: seen, tick: null };
  const document = { body, documentElement: element(), visibilityState: 'visible',
    createComment: element, createElement: element,
    querySelector: selector => selector.includes('data-od-id') ? card : state.busy,
    addEventListener: (type, fn) => { handlers[type] = fn; } };
  vm.runInNewContext(source, { document, window: { addEventListener() {} },
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    sessionStorage: { getItem: () => state.stored ? '1' : null, setItem: () => { state.stored = true; } },
    Date: { now: () => state.now }, MutationObserver: class { observe() {} },
    setInterval: fn => { state.tick = fn; return 1; }, clearInterval: () => { state.tick = null; } });
  state.popup = elements.find(node => node.className === 'catalog-pickup-popup');
  state.close = elements.find(node => node.className === 'catalog-pickup-dismiss');
  state.advance = seconds => { for (let i = 0; i < seconds; i++) { state.now += 1000; state.tick?.(); } };
  return state;
}
test('pickup opens automatically after viewing, closes, and does not repeat', () => {
  const state = setup(); state.advance(19); assert.equal(state.popup.hidden, true);
  state.advance(1); assert.equal(state.popup.hidden, false); assert.equal(state.stored, true);
  state.close.events.click(); state.advance(60); assert.equal(state.popup.hidden, true);
  const revisit = setup(true); revisit.advance(60); assert.equal(revisit.popup.hidden, true);
});
test('cookie banner and open menu postpone automatic pickup', () => {
  const state = setup(); state.busy = true; state.advance(40); assert.equal(state.popup.hidden, true);
  state.busy = false; state.classes.add('menu-open'); state.advance(40); assert.equal(state.popup.hidden, true);
  state.classes.clear(); state.advance(20); assert.equal(state.popup.hidden, false);
});
