/* Server name and picture from /api/servers and /api/server.
 * Paint the cached copy first. A later response replaces the name and picture.
 * Picture order: server icon, else the server owner's avatar, else the monogram.
 * Only https://cdn.discordapp.com image URLs are ever used.
 * Browser global window.GuildProfile + CommonJS for node --test.
 */
(function (root) {
  "use strict";

  var STALE_MS = 60 * 1000;
  var ICON_KEYS = ["icon_url", "guild_icon", "icon"];
  var OWNER_KEYS = ["owner_avatar_url", "owner_id"];
  var CDN_HOST = "cdn.discordapp.com";

  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function text(v) {
    if (v == null) return "";
    return String(v);
  }

  function guildName(row, fallback) {
    var name = "";
    if (row && typeof row === "object") {
      if (text(row.display_name).trim()) name = text(row.display_name).trim();
      else if (text(row.name).trim()) name = text(row.name).trim();
    }
    if (name) return name;
    return fallback == null ? "" : String(fallback);
  }

  /* The URL when it is https on cdn.discordapp.com (no credentials, no other
   * port), else "". Any other host, scheme or shape is ignored. */
  function cdnUrl(value) {
    var raw = text(value).trim();
    if (!raw || /[\s\\]/.test(raw) || typeof URL !== "function") return "";
    var u;
    try { u = new URL(raw); } catch (e) { return ""; }
    if (u.protocol !== "https:" || u.hostname !== CDN_HOST) return "";
    if (u.username || u.password || (u.port && u.port !== "443")) return "";
    if (u.hash) return "";
    return raw;
  }

  function guildIconUrl(row) {
    if (!row || typeof row !== "object") return "";
    var direct = cdnUrl(row.icon_url) || cdnUrl(row.guild_icon);
    if (direct) return direct;
    var icon = text(row.icon).trim();
    if (cdnUrl(icon)) return icon;
    if (icon && row.guild_id != null && /^[A-Za-z0-9_]+$/.test(icon)) {
      var ext = icon.slice(0, 2) === "a_" ? ".gif" : ".png";
      return "https://" + CDN_HOST + "/icons/" + encodeURIComponent(String(row.guild_id)) + "/" + icon + ext;
    }
    return "";
  }

  function ownerAvatarUrl(row) {
    if (!row || typeof row !== "object") return "";
    return cdnUrl(row.owner_avatar_url);
  }

  /* Pictures to try, best first: server icon, then owner avatar. An empty list
   * means the monogram. */
  function avatarSources(row) {
    var out = [];
    var icon = guildIconUrl(row);
    var owner = ownerAvatarUrl(row);
    if (icon) out.push(icon);
    if (owner && owner !== icon) out.push(owner);
    return out;
  }

  /* Next step after the picture at `index` failed to load: the next picture,
   * or "" for the monogram. */
  function nextSource(sources, index) {
    var list = Array.isArray(sources) ? sources : [];
    var i = Number(index);
    if (!(i >= -1)) return "";
    return list[i + 1] || "";
  }

  function initials(name) {
    var s = text(name).trim() || "?";
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return (s.slice(0, 2) || "?").toUpperCase();
  }

  function iconTouched(row) {
    return ICON_KEYS.some(function (k) { return hasOwn(row, k); });
  }

  /* Copy a fresh name and icon onto a cached row.
   * Keys the fresh row does not send are left alone, so a short payload
   * cannot wipe a picture the last response included. */
  function applyIdentity(dst, src) {
    if (!dst || !src || typeof dst !== "object" || typeof src !== "object") return false;
    var beforeName = guildName(dst);
    var beforeIcon = guildIconUrl(dst);
    var beforeOwner = ownerAvatarUrl(dst);
    if (hasOwn(src, "display_name")) dst.display_name = src.display_name;
    else if (hasOwn(src, "name") && !text(dst.display_name).trim()) dst.name = src.name;
    if (iconTouched(src)) {
      ICON_KEYS.forEach(function (k) {
        if (hasOwn(src, k)) dst[k] = src[k];
        else delete dst[k];
      });
    }
    OWNER_KEYS.forEach(function (k) {
      if (hasOwn(src, k)) dst[k] = src[k];
    });
    return guildName(dst) !== beforeName || guildIconUrl(dst) !== beforeIcon || ownerAvatarUrl(dst) !== beforeOwner;
  }

  /* Fill icon (and name) holes on a fresh row from the previous copy. */
  function keepMissingIdentity(freshRow, prevRow) {
    if (!freshRow || !prevRow) return freshRow;
    if (!hasOwn(freshRow, "display_name") && hasOwn(prevRow, "display_name")) freshRow.display_name = prevRow.display_name;
    if (!iconTouched(freshRow)) {
      ICON_KEYS.forEach(function (k) {
        if (hasOwn(prevRow, k)) freshRow[k] = prevRow[k];
      });
    }
    OWNER_KEYS.forEach(function (k) {
      if (!hasOwn(freshRow, k) && hasOwn(prevRow, k)) freshRow[k] = prevRow[k];
    });
    return freshRow;
  }

  function stale(savedAt, now, maxAge) {
    var at = Number(savedAt) || 0;
    if (!at) return true;
    var age = (now == null ? Date.now() : now) - at;
    var limit = maxAge == null ? STALE_MS : maxAge;
    return !(age < limit);
  }

  function findRow(payload, gid) {
    if (!payload || gid == null) return null;
    var id = String(gid);
    var lists = [payload.servers, payload.follower_servers, payload.followerServers];
    var i, j, rows;
    for (i = 0; i < lists.length; i++) {
      rows = lists[i];
      if (!Array.isArray(rows)) continue;
      for (j = 0; j < rows.length; j++) {
        if (rows[j] && String(rows[j].guild_id) === id) return rows[j];
      }
    }
    return null;
  }

  var api = {
    STALE_MS: STALE_MS,
    guildName: guildName,
    guildIconUrl: guildIconUrl,
    ownerAvatarUrl: ownerAvatarUrl,
    avatarSources: avatarSources,
    nextSource: nextSource,
    cdnUrl: cdnUrl,
    initials: initials,
    applyIdentity: applyIdentity,
    keepMissingIdentity: keepMissingIdentity,
    stale: stale,
    findRow: findRow
  };
  root.GuildProfile = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
