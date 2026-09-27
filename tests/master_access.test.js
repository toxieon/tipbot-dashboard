const test = require('node:test');
const assert = require('node:assert/strict');
const {parseTargets, escape} = require('../assets/master-access.js');

test('scope IDs retain every digit', () => {
  assert.deepEqual(parseTargets('channel:1547413800012226692, category:1547413800012226693'), [
    {target_type:'channel',target_id:'1547413800012226692'},
    {target_type:'category',target_id:'1547413800012226693'}
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
