#!/usr/bin/env bash
# Copy the voice agent skills into your AI coding tool's skills folder.
# Usage: ./install.sh claude|codex|cursor|openclaw|all  [--dir /custom/path]
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
target="${1:-}"
custom=""
if [[ "${2:-}" == "--dir" ]]; then custom="${3:-}"; fi

dir_for() {
  case "$1" in
    claude)   echo "$HOME/.claude/skills" ;;
    codex)    echo "$HOME/.codex/skills" ;;
    cursor)   echo "$HOME/.cursor/skills" ;;
    openclaw) echo "$HOME/.openclaw/skills" ;;
    *) return 1 ;;
  esac
}

install_to() {
  local dest="$1"
  mkdir -p "$dest"
  for skill in "$here"/skills/*/; do
    name="$(basename "$skill")"
    rm -rf "${dest:?}/$name"
    cp -R "$skill" "$dest/$name"
    echo "  installed $name"
  done
  echo "Done: $dest"
}

if [[ -n "$custom" ]]; then install_to "$custom"; exit 0; fi

case "$target" in
  claude|codex|cursor|openclaw) install_to "$(dir_for "$target")" ;;
  all) for t in claude codex cursor openclaw; do echo "$t:"; install_to "$(dir_for "$t")"; done ;;
  *)
    echo "Usage: ./install.sh claude|codex|cursor|openclaw|all [--dir /custom/path]"
    exit 1 ;;
esac

echo
echo "Next: copy .env.example to .env in your project and add your RETELL_API_KEY."
