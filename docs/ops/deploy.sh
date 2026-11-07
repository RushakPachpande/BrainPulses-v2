#!/usr/bin/env bash
# Thin wrapper — canonical update script lives at the repo root.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/update-deploy.sh" "$@"
