#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/ubuntu/.local/bin:$PATH"
export DISPLAY="${DISPLAY:-:1}"

OUT_DIR="/opt/cursor/artifacts/screenshots"
mkdir -p "$OUT_DIR"

wait_for_window() {
  local title="$1"
  for _ in $(seq 1 40); do
    local wid
    wid=$(xdotool search --name "$title" 2>/dev/null | tail -1 || true)
    if [[ -n "$wid" ]]; then
      echo "$wid"
      return 0
    fi
    sleep 0.25
  done
  return 1
}

shot_window() {
  local wid="$1"
  local name="$2"
  xdotool windowactivate --sync "$wid"
  sleep 1
  import -window "$wid" "$OUT_DIR/$name.png"
  echo "Captured $name"
}

kill_terminals() {
  pkill -f "xfce4-terminal.*forge-" 2>/dev/null || true
  sleep 0.5
}

launch() {
  local title="$1"
  local forge_cmd="${2:-}"
  kill_terminals
  env FORGE_CMD="$forge_cmd" xfce4-terminal \
    --title="$title" \
    --geometry=150x45 \
    --hide-scrollbar \
    --hide-menubar \
    --command="/workspace/scripts/nvim-demo.sh" \
    >/dev/null 2>&1 &
}

launch "forge-startup" ""
wid=$(wait_for_window "forge-startup")
sleep 5
shot_window "$wid" "01-nvim-startup"

launch "forge-root" 'lua require("forge.menu").root_menu()'
wid=$(wait_for_window "forge-root")
sleep 5
shot_window "$wid" "02-forge-root-menu"

launch "forge-kotlin" 'lua require("forge.menu").kotlin_menu()'
wid=$(wait_for_window "forge-kotlin")
sleep 5
shot_window "$wid" "03-forge-kotlin-menu"

launch "forge-logs" 'lua require("forge.menu").logs_menu()'
wid=$(wait_for_window "forge-logs")
sleep 5
shot_window "$wid" "04-forge-logs-menu"

launch "forge-devices" 'lua require("forge.menu").devices_menu()'
wid=$(wait_for_window "forge-devices")
sleep 5
shot_window "$wid" "05-forge-devices-menu"

launch "forge-run" 'lua require("forge.runner").run_menu()'
wid=$(wait_for_window "forge-run")
sleep 5
shot_window "$wid" "06-forge-run-menu"

launch "forge-doctor" 'lua require("forge.doctor").run()'
wid=$(wait_for_window "forge-doctor")
sleep 5
shot_window "$wid" "07-forge-doctor"

launch "forge-gradle" 'lua require("forge.gradle").menu()'
wid=$(wait_for_window "forge-gradle")
sleep 6
shot_window "$wid" "08-forge-gradle-menu"

kill_terminals
ls -la "$OUT_DIR"
