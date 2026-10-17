"""One-shot: bump the public version and record the post-settings release.

Run on the connector-post-settings branch, then delete this file.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = "0.64.3"
NEW = "0.65.1"

HTML = [
    "404.html",
    "accessibility/index.html",
    "age/index.html",
    "compare/index.html",
    "content-licence/index.html",
    "cookies/index.html",
    "index.html",
    "live/board/index.html",
    "live/index.html",
    "master/index.html",
    "pricing/index.html",
    "privacy/index.html",
    "refund/index.html",
    "renewal/index.html",
    "t/index.html",
    "terms/index.html",
    "welcome/index.html",
]

CHANGELOG = """## 0.65.1 · 2026-10-17 · `post-settings` · Post settings on a connector

- Connector setup has a Post settings section: toggles for the lines on a posted tip, a bookmaker choice, and a live preview of the post.
- That section loads from an owner-only script. The public site build leaves it out.

Tests: `tests/post_settings.test.js`.

"""

PUBLIC = """## 0.65.1

Internal improvements.

"""


def replace_version(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if OLD not in text:
        raise SystemExit(f"missing {OLD} in {path}")
    path.write_text(text.replace(OLD, NEW), encoding="utf-8")


def insert_after_anchor(path: Path, anchor: str, addition: str) -> None:
    text = path.read_text(encoding="utf-8")
    if addition.strip() in text:
        return
    if anchor not in text:
        raise SystemExit(f"missing anchor in {path}")
    path.write_text(text.replace(anchor, anchor + addition, 1), encoding="utf-8")


def main() -> None:
    for rel in HTML:
        replace_version(ROOT / rel)
    version = ROOT / "VERSION"
    if version.read_text(encoding="utf-8").strip() != NEW:
        version.write_text(NEW + "\n", encoding="utf-8")
    clog = ROOT / "CHANGELOG.md"
    current = clog.read_text(encoding="utf-8")
    if not current.startswith("## 0.65.1"):
        clog.write_text(CHANGELOG + current, encoding="utf-8")
    pub = ROOT / "PUBLIC_CHANGELOG.md"
    public = pub.read_text(encoding="utf-8")
    if not public.startswith("## 0.65.1"):
        pub.write_text(PUBLIC + public, encoding="utf-8")
    build = ROOT / "scripts" / "build-public.mjs"
    src = build.read_text(encoding="utf-8")
    src2 = src.replace(
        '  "assets/connector-push.js",\n]);',
        '  "assets/connector-push.js",\n  "assets/connector-post.js",\n]);',
        1,
    )
    src2 = src2.replace(
        '  "data-cx-push",\n  "/api/slip/leg-note",',
        '  "data-cx-push",\n  "data-cx-post",\n  "connector-post",\n  "Post settings",\n  "/api/slip/leg-note",',
        1,
    )
    if src2 == src:
        raise SystemExit("build-public.mjs anchors missing")
    build.write_text(src2, encoding="utf-8")
    gate = ROOT / "tests" / "settings-tab-gate.test.js"
    g = gate.read_text(encoding="utf-8")
    needle = '  assert.equal(ASSET_DENY.has("assets/connector-push.js"), true);\n'
    extra = needle + '  assert.equal(ASSET_DENY.has("assets/connector-post.js"), true);\n'
    if "connector-post.js" not in g:
        if needle not in g:
            raise SystemExit("settings gate anchor missing")
        gate.write_text(g.replace(needle, extra, 1), encoding="utf-8")
    pub_test = ROOT / "tests" / "public_build.test.js"
    p = pub_test.read_text(encoding="utf-8")
    row = '      "assets/connector-push.js",\n'
    if "connector-post.js" not in p:
        if row not in p:
            raise SystemExit("public build test anchor missing")
        pub_test.write_text(p.replace(row, row + '      "assets/connector-post.js",\n', 1), encoding="utf-8")
    ready = ROOT / ".github" / "post-settings-ready.txt"
    if ready.exists():
        ready.unlink()


if __name__ == "__main__":
    main()
