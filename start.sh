#!/bin/sh
# Launcher for the Finance app (for example from a systemd unit).
# Runs from the repo this script lives in, using whatever node and pnpm are on PATH.
cd "$(dirname "$0")" || exit 1
exec pnpm start
