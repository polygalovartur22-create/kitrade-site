import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../catalog-app.js', import.meta.url), 'utf8');
test('typing, submit and clearing update search with the latest value', () => {
  const block = source.slice(source.indexOf('  const searchInput ='), source.indexOf('  document.querySelector("#resetFilters")'));
  const listeners = {}, form = {};
  const input = { value: '', addEventListener: (name, fn) => { listeners[name] = fn; } };
  const state = { query: '', offset: 24 };
  let scheduled, renders = 0, resets = 0;
  vm.runInNewContext(block, { document: { querySelector: selector => selector === '#catalogQuery' ? input : { addEventListener: (name, fn) => { form[name] = fn; } } },
    state, clearFilterControls: () => { resets++; }, resetPaging: () => { state.offset = 0; }, render: () => { renders++; },
    setTimeout: fn => { scheduled = fn; return 1; }, clearTimeout: () => { scheduled = null; } });
  input.value = 'фар'; listeners.input({});
  assert.equal(renders, 0);
  input.value = 'фара'; listeners.input({}); scheduled();
  assert.equal(state.query, 'фара'); assert.equal(state.offset, 0); assert.equal(renders, 1);
  input.value = '81110'; listeners.input({}); form.submit({ preventDefault() {} });
  assert.equal(state.query, '81110'); assert.equal(scheduled, null);
  input.value = ''; listeners.input({});
  assert.equal(state.query, ''); assert.equal(renders, 3); assert.equal(resets, 2);
  input.value = 'крыло'; listeners.input({ isComposing: true });
  assert.equal(scheduled, null); listeners.compositionend(); assert.equal(state.query, 'крыло');
});
