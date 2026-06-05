#!/usr/bin/env bash
# link-plugins.sh — install this repo's plugins into the Myra Agents plugin dir.
#
# A plugin is any directory here containing a manifest.json (agents/*,
# notifications/*, integrations/*). By default each is symlinked into
# ~/.myra-agents/plugins/<name>/ so you can edit in place — restart the app to
# rescan. Re-runnable (idempotent).
#
# Usage:
#   ./link-plugins.sh [--demo] [--copy] [--unlink] [name ...]
#
#   --demo     target ~/.myra-agents-demo/plugins (app-demo mode)
#   --copy     copy instead of symlink (for a real install, not dev)
#   --unlink   remove the installed plugins instead of adding them
#   name ...   limit to these plugin dir names (default: all)
set -eu

ROOT="$(cd "$(dirname "$0")" && pwd)"

DEMO=0
COPY=0
UNLINK=0
ONLY=""

for arg in "$@"; do
  case "$arg" in
    --demo)   DEMO=1 ;;
    --copy)   COPY=1 ;;
    --unlink) UNLINK=1 ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    -*)
      echo "link-plugins: unknown flag: $arg" >&2
      exit 2 ;;
    *)        ONLY="$ONLY $arg" ;;
  esac
done

if [ "$DEMO" -eq 1 ]; then
  DST="$HOME/.myra-agents-demo/plugins"
else
  DST="$HOME/.myra-agents/plugins"
fi

mkdir -p "$DST"

# wanted name -> is it in the ONLY filter (empty filter = all)
wanted() {
  [ -z "$ONLY" ] && return 0
  for n in $ONLY; do
    [ "$n" = "$1" ] && return 0
  done
  return 1
}

count=0
for manifest in "$ROOT"/*/*/manifest.json; do
  [ -e "$manifest" ] || continue        # no glob match
  src="$(dirname "$manifest")"
  name="$(basename "$src")"
  wanted "$name" || continue
  target="$DST/$name"

  if [ "$UNLINK" -eq 1 ]; then
    if [ -e "$target" ] || [ -L "$target" ]; then
      rm -rf "$target"
      echo "unlinked  $name"
      count=$((count + 1))
    fi
    continue
  fi

  rm -rf "$target"
  if [ "$COPY" -eq 1 ]; then
    cp -R "$src" "$target"
    echo "copied    $name -> $target"
  else
    ln -sfn "$src" "$target"
    echo "linked    $name -> $target"
  fi
  count=$((count + 1))
done

echo "---"
echo "$count plugin(s) processed in $DST"
echo "restart the Myra Agents app to pick up changes."
