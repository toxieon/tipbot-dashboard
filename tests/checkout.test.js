// node --test tests/   0.45.1: pricing config and the Stripe checkout stub.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const checkout = require("../assets/site/checkout.js");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets/site/checkout.js"), "utf8");
const pricing = fs.readFileSync(path.join(root, "pricing/index.html"), "utf8");

test("indicative plans match the pricing page", () => {
  const plans = checkout.PLANS;
  assert.equal(plans.free.priceAud, 0);
  assert.equal(plans.free.interval, "month");
  assert.equal(plans.mytipbot_year.priceAud, 29);
  assert.equal(plans.mytipbot_year.interval, "year");
  assert.equal(plans.mytipbot_year.bestValue, true);
  assert.equal(plans.mytipbot_year.approxPerMonthAud, 2.42);
  assert.equal(Math.round((plans.mytipbot_year.priceAud / 12) * 100) / 100, 2.42);
  assert.equal(plans.mytipbot_month.priceAud, 3);
  assert.equal(plans.mytipbot_month.interval, "month");
  assert.equal(plans.pro.name, "My TipBot Pro");
  assert.equal(plans.pro.priceAud, 8);
  assert.equal(plans.pro.interval, "month");
  assert.equal(plans.tipster.priceAud, 0);
  assert.equal(plans.tipster.revenueShare, 0.25);
  for (const plan of Object.values(plans)) {
    assert.equal(plan.stripePriceId, null, plan.id);
    assert.equal(plan.id, plan.id);
    assert.ok(plan.name);
  }
  assert.equal(checkout.formatAud(0), "A$0");
  assert.equal(checkout.formatAud(29), "A$29");
  assert.equal(checkout.formatAud(3), "A$3");
  assert.equal(checkout.formatAud(8), "A$8");
  assert.equal(checkout.formatAud(2.42, 2), "A$2.42");
});

test("startCheckout is a waitlist stub until a Stripe price id exists", () => {
  const year = checkout.startCheckout("mytipbot_year");
  assert.equal(year.status, "waitlist");
  assert.equal(year.planId, "mytipbot_year");
  assert.equal(year.priceAud, 29);
  assert.equal(year.interval, "year");
  assert.equal(year.stripePriceId, null);
  for (const id of ["free", "mytipbot_month", "pro", "tipster"]) {
    const result = checkout.startCheckout(id);
    assert.equal(result.status, "waitlist");
    assert.equal(result.stripePriceId, null);
  }
  assert.throws(() => checkout.startCheckout("nope"), /Unknown plan/);
});

test("Stripe redirect hook runs only when a price id is set", () => {
  const plan = checkout.PLANS.pro;
  const prev = plan.stripePriceId;
  let seen = null;
  plan.stripePriceId = "price_test_pro";
  try {
    const idle = checkout.startCheckout("pro");
    assert.equal(idle.status, "needs_checkout");
    assert.equal(idle.stripePriceId, "price_test_pro");
    const redirected = checkout.startCheckout("pro", {
      redirectToCheckout: function (opts) {
        seen = opts;
        return {status: "redirect", priceId: opts.priceId};
      }
    });
    assert.equal(seen.priceId, "price_test_pro");
    assert.equal(seen.planId, "pro");
    assert.equal(seen.priceAud, 8);
    assert.equal(seen.interval, "month");
    assert.equal(redirected.status, "redirect");
  } finally {
    plan.stripePriceId = prev;
  }
  assert.equal(checkout.PLANS.pro.stripePriceId, null);
  assert.match(src, /TODO: Stripe Checkout/);
  assert.match(src, /stripe\.redirectToCheckout/);
  assert.match(src, /session\.url/);
});

test("pricing page states the indicative offers and the waitlist stub", () => {
  assert.match(pricing, /Free to follow\. From A\$2\.42\/mo to get serious\./);
  assert.match(pricing, /Tipsters join free and earn 25% of the My TipBot subs their followers pay\./);
  assert.match(pricing, /BEST VALUE/);
  assert.match(pricing, /About A\$2\.42\/mo billed yearly/);
  assert.match(pricing, /A\$3\/mo/);
  assert.match(pricing, /A\$29/);
  assert.match(pricing, /A\$8/);
  assert.match(pricing, /A\$0/);
  assert.match(pricing, /Earn 25% of My TipBot subs/);
  assert.match(pricing, /Personal bet log/);
  assert.match(pricing, /Bankroll and P&amp;L across all your bookies/);
  assert.match(pricing, /Slip-photo import/);
  assert.match(pricing, /25% of subs from your followers/);
  assert.match(pricing, /All prices indicative, in AUD, and subject to change/);
  assert.match(pricing, /18\+/);
  assert.match(pricing, /Gambling Help Online/);
  assert.match(pricing, /1800 858 858/);
  assert.match(pricing, /gamblinghelponline\.org\.au/);
  assert.match(pricing, /startCheckout/);
  const site = fs.readFileSync(path.join(root, "assets/site/site.js"), "utf8");
  assert.match(site, /Coming soon/);
  assert.match(site, /join the waitlist/);
});
