const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const card = require("../assets/meme-pike.js");
const data = {allowed:true,type:"meme-pike", ride:{horse:"Fixture Horse",meeting:"Fixture Park",race_number:7}};
const fixtureGuild = "fixture-verified-server";
test("verified destination gets meme treatment and disclaimer, without betting performance language", () => {
  const html = card.render(data);
  for (const text of ["MEME PICK", "Meme Pike", "Fixture Horse", "Fixture Park", "Race 7", card.disclaimer])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /units?|stakes?|ROI|2-from-8|edge|1u/i);
});
test("missing or refused backend capability never renders", () => {
  assert.equal(card.render({...data,allowed:false}), "");
  assert.equal(card.render({...data,allowed:false}), "");
  assert.equal(card.render(null), "");
});
test("only dedicated builtin type renders", () => {
  assert.equal(card.render({...data,type:"predictor"}), "");
});
test("labels are escaped, not trusted HTML", () => {
  const html = card.render({...data,ride:{...data.ride,horse:'<img src=x onerror=alert(1)>'}});
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
test("Apex scoped card uses the loud pink background", () => {
  const css = fs.readFileSync(require.resolve("../assets/meme-pike.css"), "utf8");
  assert.match(css, /html\[data-theme="apex"\] \.meme-pike-card/);
  assert.match(css, /background: #FF2D95/);
  assert.equal(card.color, "#FF2D95");
});
test("empty current selection does not imply a live pick", () => {
  const html = card.render({allowed:true,type:"meme-pike"});
  assert.match(html, /No current pick/);
  assert.match(html, /For laughs only/);
});

test("server detail mounts the backend authorized payload without altering statistical cards", () => {
  const html=fs.readFileSync(require.resolve("../index.html"),"utf8");
  assert.match(html,/MemePike.render\(d.meme_pike\)/);
  assert.match(html,/assets\/meme-pike.css/);
  assert.match(html,/assets\/meme-pike.js/);
});

test("push-secret panels omit every shape of meme connector payload", () => {
  const panel=require("../assets/connector-push.js");
  const meme={id:"m",type:"meme-pike"};
  for(const body of [{connectors:[meme]},{connector:meme},meme]) assert.deepEqual(panel.listFrom(body),[]);
});
