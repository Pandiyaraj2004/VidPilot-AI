import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceSession, clearWorkspaceSession } from '../src/workspaceSession.ts';
const key = 'vidpilot-session';
const valid = `2000.${'a'.repeat(64)}`;
const next = `3000.${'b'.repeat(64)}`;
function store(initial) {
  const values = new Map(initial ? [[key, initial]] : []);
  return {getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k)};
}
test('private access survives opening another tab', () => {
  const persistent = store();
  assert.equal(readWorkspaceSession(`#access=${valid}`, persistent, store(), 1000), valid);
  assert.equal(readWorkspaceSession('', persistent, store(), 1000), valid);
});
test('existing tab sessions migrate without signing in again', () => {
  const persistent = store();
  assert.equal(readWorkspaceSession('', persistent, store(valid), 1000), valid);
  assert.equal(persistent.getItem(key), valid);
});
test('a fresh private link replaces the previous session', () => {
  const persistent = store(valid);
  assert.equal(readWorkspaceSession(`#access=${next}`, persistent, store(valid), 1000), next);
  assert.equal(persistent.getItem(key), next);
});
test('expired sessions are removed from both stores', () => {
  const persistent = store(valid), tab = store(valid);
  assert.equal(readWorkspaceSession('', persistent, tab, 2000), '');
  assert.equal(persistent.getItem(key), null);
  assert.equal(tab.getItem(key), null);
});
test('malformed links do not replace a valid session', () => {
  assert.equal(readWorkspaceSession('#access=invalid', store(valid), store(), 1000), valid);
});
test('browser storage restrictions retain tab fallback', () => {
  const blocked = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}, removeItem() {throw Error('blocked');}};
  assert.equal(readWorkspaceSession('', blocked, store(valid), 1000), valid);
});
test('server-rejected sessions are cleared everywhere', () => {
  const persistent = store(valid), tab = store(valid);
  clearWorkspaceSession(persistent, tab);
  assert.equal(readWorkspaceSession('', persistent, tab, 1000), '');
});
