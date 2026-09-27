const test = require('node:test');
const assert = require('node:assert/strict');
const {mapLimit, createDedupe, singleFlight} = require('../assets/req-pool.js');
const tick = (ms) => new Promise(r => setTimeout(r, ms));

test('mapLimit caps concurrency and keeps input order', async () => {
  let active = 0, peak = 0;
  const out = await mapLimit([5, 1, 4, 2, 3, 0, 6], 3, async (v) => {
    active++; peak = Math.max(peak, active);
    await tick(v * 3);
    active--; return v * 10;
  });
  assert.deepEqual(out, [50, 10, 40, 20, 30, 0, 60]);
  assert.equal(peak, 3);
});
test('mapLimit handles empty lists and bad limits', async () => {
  assert.deepEqual(await mapLimit([], 3, async () => 1), []);
  assert.deepEqual(await mapLimit([1, 2], 0, async (v) => v), [1, 2]);
});
test('createDedupe shares one in-flight call per key and clears after settle', async () => {
  const d = createDedupe();
  let calls = 0;
  const start = async () => { calls++; await tick(10); return {n: calls}; };
  const view = (v) => Object.assign({}, v);
  const [a, b] = await Promise.all([d.run('k', start, view), d.run('k', start, view)]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b); assert.notEqual(a, b);
  assert.equal(d.size(), 0);
  await d.run('k', start, view);
  assert.equal(calls, 2);
});
test('createDedupe does not cache failures', async () => {
  const d = createDedupe();
  let calls = 0;
  await assert.rejects(d.run('x', async () => { calls++; throw new Error('boom'); }));
  assert.equal(d.size(), 0);
  assert.equal(await d.run('x', async () => { calls++; return 7; }), 7);
  assert.equal(calls, 2);
});
test('singleFlight skips overlapping calls', async () => {
  let calls = 0;
  const f = singleFlight(async () => { calls++; await tick(15); return calls; });
  const p1 = f(); const p2 = f();
  assert.equal(f.busy(), true);
  assert.equal(await p1, 1); assert.equal(await p2, 1);
  assert.equal(f.busy(), false);
  assert.equal(await f(), 2);
});
