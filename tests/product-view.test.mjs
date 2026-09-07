import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('full screen view preserves the catalog, back and Escape close it, forward reopens', () => {
  class Element {
    constructor() { this.events = {}; this.nodes = new Map(); this.dataset = {}; this.classList = { add() {}, remove() {} }; }
    setAttribute() {} removeAttribute() {} replaceChildren() {} append() {} focus() { this.focused = true; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    fire(type, event = {}) { (this.events[type] || []).forEach(fn => fn(event)); }
    querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new Element()); return this.nodes.get(key); }
    querySelectorAll() { return []; }
    showModal() { this.open = true; } close() { this.open = false; this.fire('close'); }
  }
  const doc = new Element(); const root = new Element(); const win = new Element();
  const opener = new Element(); opener.isConnected = true;
  doc.documentElement = root; doc.activeElement = opener;
  let dialog;
  doc.createElement = tag => { const element = new Element(); if (tag === 'dialog') dialog = element; return element; };
  doc.dispatchEvent = event => doc.fire(event.type, event);
  win.location = { protocol: 'https:', href: 'https://example.com/catalog/?q=test', origin: 'https://example.com' };
  win.scrollY = 850; win.scrollTo = (x, y) => { win.scrollY = y; };
  win.KITRADE_CATALOG_DATA = { items: [{ id: 'A', title: 'Фара', canonical_path: '/catalog/product/a/', photos: [], indexable: true }] };
  const ids = []; let quantity = 0;
  win.KITRADE_CART = { ids: () => ids, get: () => quantity ? { quantity } : undefined,
    add: item => { if (!ids.includes(item.id)) ids.push(item.id); quantity = Math.max(1, quantity); },
    changeQuantity: (id, delta) => { quantity = Math.max(0, quantity + delta); if (!quantity) ids.splice(0); } };
  const history = { state: { filters: 'unchanged' }, pushState(state) { this.state = state; }, back() { this.saved = this.state; this.state = { filters: 'unchanged' }; win.fire('popstate'); } };
  vm.runInNewContext(fs.readFileSync(new URL('../product-quick-view.js', import.meta.url), 'utf8'), {
    window: win, document: doc, history, URL, CustomEvent: class { constructor(type) { this.type = type; } }
  });
  const link = { dataset: { productId: 'A' } };
  const target = { closest: selector => selector === 'a[data-product-link]' ? link : null };
  doc.fire('click', { target, button: 0, preventDefault() {} });
  assert.equal(dialog.open, true);
  assert.equal(history.state.filters, 'unchanged');
  assert.match(dialog.innerHTML, /Назад в каталог/);
  dialog.querySelector('[data-quick-add]').fire('click');
  assert.deepEqual(ids, ['A']);
  assert.equal(dialog.querySelector('[data-quick-add]').hidden, true);
  assert.equal(dialog.querySelector('[data-quick-count]').textContent, '1');
  dialog.querySelector('[data-quick-plus]').fire('click');
  assert.equal(dialog.querySelector('[data-quick-count]').textContent, '2');
  dialog.querySelector('[data-quick-minus]').fire('click');
  dialog.querySelector('[data-quick-minus]').fire('click');
  assert.equal(dialog.querySelector('[data-quick-add]').hidden, false);
  assert.equal(dialog.querySelector('[data-quick-quantity]').hidden, true);
  assert.equal(dialog.open, true);
  dialog.querySelector('[data-quick-close]').fire('click');
  assert.equal(dialog.open, false);
  assert.equal(win.scrollY, 850);
  assert.equal(opener.focused, true);
  history.state = history.saved; win.fire('popstate');
  assert.equal(dialog.open, true);
  dialog.fire('cancel', { preventDefault() {} });
  assert.equal(dialog.open, false);
});
