/* Meme Pike presentation. Eligibility is authorized by the backend payload. */
(function (root) {
  "use strict";
  var disclaimer = "For laughs only. Not a tip.";
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c];
    });
  }
  function render(data) {
    if (!data || data.allowed !== true || data.type !== "meme-pike") return "";
    var ride = data.ride;
    var jump = ride && ride.start ? new Intl.DateTimeFormat("en-AU", {timeZone:"Australia/Melbourne", dateStyle:"medium", timeStyle:"short"}).format(new Date(ride.start)) : "";
    var body = ride ? '<h3>' + esc(ride.horse) + '</h3><p>' + esc(ride.meeting)
      + ' · Race ' + esc(ride.race_number) + '</p>' + (jump ? '<p>' + esc(jump) + ' Melbourne</p>' : '') + '<p class="mp-provisional">'
      + (data.status === 'closed' ? 'Race has started. Meme pick archive.' : 'Last currently booked William Pike ride. Provisional until jump.') + '</p>'
      : '<p>' + (data.status === 'sending' ? 'Post status uncertain — awaiting reconciliation.' : 'No current pick.') + '</p>';
    return '<article class="meme-pike-card" aria-label="Meme Pike — for laughs only">'
      + '<span class="mp-label">MEME PICK</span><h2>Meme Pike</h2>' + body
      + (data.enabled === false ? '<p>Paused — updates are off.</p>' : '')
      + '<p class="mp-disclaimer">' + disclaimer + '</p></article>';
  }
  var api = {render: render, color: "#FF2D95", disclaimer: disclaimer};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MemePike = api;
})(typeof window !== "undefined" ? window : globalThis);
