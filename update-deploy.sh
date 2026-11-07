#!/usr/bin/env bash
# BrainPulses v2.0 — update deploy after initial setup.
#
#   cd /root/apps/BrainPulses_v2.0
#   sudo bash update-deploy.sh          # build + migrate + reload + rsync
#   sudo bash update-deploy.sh --pull   # git pull --ff-only first
#
# Does not touch Docker, nginx, certbot, or api/uploads.
# Does not run prisma seed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_WWW="${ADMIN_WWW:-/var/www/brainpulses/admin}"
PARTICIPANT_WWW="${PARTICIPANT_WWW:-/var/www/brainpulses/participant}"
PM2_APP="${PM2_APP:-brainpulses-api}"
DO_PULL=0

for arg in "$@"; do
  case "$arg" in
    --pull) DO_PULL=1 ;;
    -h|--help)
      echo "Usage: sudo bash update-deploy.sh [--pull]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo bash update-deploy.sh)."

require_file() {
  [[ -f "$1" ]] || die "Missing required file: $1"
}

require_file "api/.env.prod"
require_file "admin/.env.production"
require_file "participant/.env.production"

if [[ "$DO_PULL" -eq 1 ]]; then
  log "git pull --ff-only"
  git pull --ff-only
fi

mkdir -p "$REPO_ROOT/api/logs" "$ADMIN_WWW" "$PARTICIPANT_WWW"

log "Install dependencies (ci)"
npm ci --prefix api
npm ci --prefix admin
npm ci --prefix participant

log "Prisma migrate deploy"
(
  cd api
  export NODE_ENV=production
  npx prisma migrate deploy
)

log "Build API"
npm run build --prefix api

log "Start/reload PM2 ecosystem (API + worker)"
pm2 startOrReload "$REPO_ROOT/api/ecosystem.config.cjs" --env production
pm2 save

log "Build Admin + Participant"
npm run build --prefix admin
npm run build --prefix participant

log "Publish static sites (backup then rsync)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -d "$ADMIN_WWW" ]] && [[ -n "$(ls -A "$ADMIN_WWW" 2>/dev/null || true)" ]]; then
  rm -rf "${ADMIN_WWW}.prev"
  cp -a "$ADMIN_WWW" "${ADMIN_WWW}.prev"
fi
if [[ -d "$PARTICIPANT_WWW" ]] && [[ -n "$(ls -A "$PARTICIPANT_WWW" 2>/dev/null || true)" ]]; then
  rm -rf "${PARTICIPANT_WWW}.prev"
  cp -a "$PARTICIPANT_WWW" "${PARTICIPANT_WWW}.prev"
fi

rsync -a --delete "$REPO_ROOT/admin/dist/" "$ADMIN_WWW/"
rsync -a --delete "$REPO_ROOT/participant/dist/" "$PARTICIPANT_WWW/"

log "Smoke health (loopback)"
curl -fsS "http://127.0.0.1:3002/health" | head -c 200
echo
curl -fsS "http://127.0.0.1:3002/health/ready" | head -c 200
echo

echo "Deploy finished at $stamp"
echo "SPA rollback dirs (if present): ${ADMIN_WWW}.prev  ${PARTICIPANT_WWW}.prev"
