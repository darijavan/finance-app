#!/bin/sh
# systemd-friendly launcher for the Finance app.
# Uses the Node 24 toolchain directly (no interactive nvm shell needed).
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "$HOME/Projects/finance-app" || exit 1
exec pnpm start
