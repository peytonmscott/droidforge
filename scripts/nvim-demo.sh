#!/usr/bin/env bash
export PATH="/home/ubuntu/.local/bin:$PATH"
cd /workspace/demo/kmp-sample

NVIM_ARGS=(
  -u "$HOME/.config/nvim/init.lua"
  composeApp/src/commonMain/kotlin/App.kt
)

if [[ -n "${FORGE_CMD:-}" ]]; then
  nvim "${NVIM_ARGS[@]}" -c "$FORGE_CMD"
else
  nvim "${NVIM_ARGS[@]}"
fi

echo
echo "Press Enter to close"
read
