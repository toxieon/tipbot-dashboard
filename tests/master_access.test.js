const test = require('node:test');
const assert = require('node:assert/strict');
const {parseTargets, escape} = require('../assets/master-access.js');

test('scope IDs retain every digit', () => {
  assert.deepEqual(parseTargets('channel:100000000000000001, category:100000000000000002'), [
    {target_type:'channel',target_id:'100000000000000001'},
    {target_type:'category',target_id:'100000000000000002'}
  ]);
});
test('invalid scopes and numbers are rejected', () => {
  for (const text of ['channel:1e18','channel:-12','role:123','123','channel:1.5']) {
    assert.throws(() => parseTargets(text));
  }
});
test('server labels cannot inject markup', () => {
  assert.equal(escape('<img src=x onerror="bad()">'), '&lt;img src=x onerror=&quot;bad()&quot;&gt;');
});
