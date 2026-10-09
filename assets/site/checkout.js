/* Tipdash 0.45.1 — public pricing plans and the Stripe checkout stub.
 * One module on purpose: plan ids, prices and the future Stripe hook live here.
 * No payments, no keys, no backend. Browser global TipdashCheckout + CommonJS.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TipdashCheckout = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* Indicative AUD prices (Ray / Kevin, 6 Oct 2026). stripePriceId stays null
     until a Stripe Price exists for that plan. */
  var PLANS = {
    free: {
      id: "free",
      name: "Free",
      audience: "For followers getting started",
      priceAud: 0,
      interval: "month",
      stripePriceId: null,
      cta: "Get started"
    },
    mytipbot_year: {
      id: "mytipbot_year",
      name: "My TipBot",
      audience: "For followers who bet",
      priceAud: 29,
      interval: "year",
      approxPerMonthAud: 2.42,
      bestValue: true,
      stripePriceId: null,
      cta: "Start My TipBot"
    },
    mytipbot_month: {
      id: "mytipbot_month",
      name: "My TipBot",
      audience: "For followers who bet",
      priceAud: 3,
      interval: "month",
      stripePriceId: null,
      cta: "Start My TipBot"
    },
    pro: {
      id: "pro",
      name: "My TipBot Pro",
      audience: "For serious punters",
      priceAud: 8,
      interval: "month",
      stripePriceId: null,
      cta: "Go Pro"
    },
    tipster: {
      id: "tipster",
      name: "Tipster",
      audience: "For tipsters with a following",
      priceAud: 0,
      interval: null,
      revenueShare: 0.25,
      stripePriceId: null,
      cta: "Join as a tipster"
    }
  };

  function formatAud(amount, decimals) {
    var n = Number(amount);
    if (!Number.isFinite(n)) n = 0;
    var d = decimals == null ? (Math.round(n * 100) % 100 === 0 ? 0 : 2) : decimals;
    var sign = n < 0 ? "\u2212" : "";
    var text = Math.abs(n).toFixed(d);
    var parts = text.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "A$" + parts.join(".");
  }

  function planById(planId) {
    return PLANS[planId] || null;
  }

  /* Start checkout for a plan id.
     Returns {status:"waitlist"} until that plan has a stripePriceId.
     hooks.redirectToCheckout is only called once a price id is set. */
  function startCheckout(planId, hooks) {
    var plan = PLANS[planId];
    if (!plan) {
      var err = new Error("Unknown plan: " + planId);
      err.code = "unknown_plan";
      throw err;
    }
    var redirect = hooks && hooks.redirectToCheckout;
    // TODO: Stripe Checkout
    // When plan.stripePriceId is set, create a Checkout Session on the server
    // (no secret key in this static site) and send the browser there:
    //   stripe.redirectToCheckout({ sessionId: session.id })
    // or a Checkout Session URL:
    //   window.location.assign(session.url)
    if (plan.stripePriceId) {
      var opts = {
        planId: plan.id,
        priceId: plan.stripePriceId,
        priceAud: plan.priceAud,
        interval: plan.interval
      };
      if (typeof redirect === "function") return redirect(opts);
      return {
        status: "needs_checkout",
        planId: plan.id,
        name: plan.name,
        priceAud: plan.priceAud,
        interval: plan.interval,
        stripePriceId: plan.stripePriceId
      };
    }
    return {
      status: "waitlist",
      planId: plan.id,
      name: plan.name,
      priceAud: plan.priceAud,
      interval: plan.interval,
      stripePriceId: null
    };
  }

  return {
    PLANS: PLANS,
    formatAud: formatAud,
    planById: planById,
    startCheckout: startCheckout
  };
});
