import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../cart-store.js', import.meta.url), 'utf8');
function tab(data, blocked = false, lifecycle = {}) {
  const listeners = {};
  const window = { addEventListener: (type, fn) => (listeners[type] ||= []).push(fn), dispatchEvent: event => (listeners[event.type] || []).forEach(fn => fn(event)) };
  const storage = {
    get length() { return data.size; }, key: n => [...data.keys()][n],
    getItem: key => { if (blocked) throw Error('blocked'); return data.get(key) || null; },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); data.set(key, value); }
  };
  const docListeners = {};
  const document = { readyState: 'loading', visibilityState: 'visible', addEventListener(type, fn) { docListeners[type] = fn; } };
  lifecycle.resume = () => { document.visibilityState = 'visible'; docListeners.visibilitychange?.(); };
  lifecycle.watch = fn => window.addEventListener('kitrade:cart-change', fn);
  vm.runInNewContext(source, { window, document, localStorage: storage, CustomEvent: class { constructor(type) { this.type = type; } } });
  return window.KITRADE_CART;
}
test('migrates old IDs, preserves unavailable products and survives a new page', () => {
  const data = new Map([['kitradeCatalogSelectionV1', '["old","unavailable"]']]);
  const cart = tab(data);
  cart.add({ id: 'new', title: 'Фара' });
  assert.deepEqual([...tab(data).ids()].sort(), ['new', 'old', 'unavailable']);
  cart.remove('old');
  assert.deepEqual([...tab(data).ids()].sort(), ['new', 'unavailable']);
});

test('resuming a suspended tab refreshes UI and never resurrects deleted storage entries', () => {
  const data = new Map(), lifecycle = {};
  const cart = tab(data, false, lifecycle);
  cart.add({ id: 'A' }); cart.changeQuantity('A', 1);
  let rendered;
  lifecycle.watch(() => { rendered = cart.items(); });
  tab(data).changeQuantity('A', 3);
  lifecycle.resume();
  assert.equal(rendered[0].quantity, 5);
  data.delete('kitradeCartItemV2:A');
  lifecycle.resume();
  assert.equal(rendered.length, 0);
  assert.equal(tab(data).items().length, 0);
});
test('independent tabs preserve additions and removals without stale array overwrite', () => {
  const data = new Map(); const a = tab(data); const b = tab(data);
  a.add({ id: 'A' }); b.add({ id: 'B' }); a.remove('A'); b.add({ id: 'C' });
  assert.deepEqual([...a.ids()].sort(), ['B', 'C']);
  const submitted = [...a.ids()]; b.add({ id: 'D' }); a.remove(submitted);
  assert.deepEqual([...b.ids()], ['D']);
});
test('same item is not duplicated and rejected storage retains in-page selection', () => {
  const cart = tab(new Map(), true);
  cart.add({ id: 'A' }); cart.add({ id: 'A' });
  assert.equal(cart.ids().length, 1);
  assert.equal(cart.persistent, false);
});
test('quantity survives reload, changes in another tab and consumes only submitted units', () => {
  const data = new Map(); const cart = tab(data);
  cart.add({ id: 'A' });
  assert.equal(cart.get('A').quantity, 1);
  cart.changeQuantity('A', 1);
  const other = tab(data);
  assert.equal(other.get('A').quantity, 2);
  other.add({ id: 'A' });
  assert.equal(other.get('A').quantity, 2);
  other.changeQuantity('A', 1);
  cart.consume([{ product_id: 'A', quantity: 2 }]);
  assert.equal(other.get('A').quantity, 1);
  other.changeQuantity('A', -1);
  assert.equal(cart.ids().length, 0);
});
