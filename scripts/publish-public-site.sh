#!/usr/bin/env bash
# Copy the built site onto the public-site branch and push it.
# The push does not rewrite existing history.
set -euo pipefail

dist="${1:-dist}"
branch="${PUBLIC_SITE_BRANCH:-public-site}"
remote="${PUBLIC_SITE_REMOTE:-}"

if [ -z "$remote" ]; then
  if [ -z "${GITHUB_REPOSITORY:-}" ]; then
    echo "public site publish: repository is not set" >&2
    exit 1
  fi
  remote="https://github.com/${GITHUB_REPOSITORY}.git"
fi

if [ ! -d "$dist" ]; then
  echo "public site publish: built output missing" >&2
  exit 1
fi

version="$(tr -d '[:space:]' < "$dist/VERSION")"
site="$(mktemp -d)"
askpass=""
cleanup() {
  rm -rf "$site"
  if [ -n "$askpass" ]; then rm -f "$askpass"; fi
}
trap cleanup EXIT

if [ -n "${GITHUB_TOKEN:-}" ] && [[ "$remote" == https://* ]]; then
  askpass="$(mktemp)"
  cat > "$askpass" << 'EOF'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *) printf '%s\n' "$GITHUB_TOKEN" ;;
esac
EOF
  chmod 700 "$askpass"
  export GIT_ASKPASS="$askpass"
  export GIT_TERMINAL_PROMPT=0
fi

if git ls-remote --heads "$remote" "$branch" | grep -q "refs/heads/${branch}$"; then
  git clone --branch "$branch" --single-branch --origin origin "$remote" "$site"
  existed=1
else
  git init -b "$branch" "$site" >/dev/null
  git -C "$site" remote add origin "$remote"
  existed=0
fi

git -C "$site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git -C "$site" config user.name "github-actions[bot]"

find "$site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$dist"/. "$site"/
git -C "$site" add -A
if git -C "$site" diff --cached --quiet; then
  echo "public-site already matches this build"
  exit 0
fi
git -C "$site" commit -m "Publish ${version}" >/dev/null
if [ "$existed" = 1 ]; then
  git -C "$site" push origin "HEAD:${branch}"
else
  git -C "$site" push -u origin "HEAD:${branch}"
fi
echo "public-site updated (${version})"
