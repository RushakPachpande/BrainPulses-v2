#!/usr/bin/env bash
# BrainPulses v2.0 — one-time VPS bootstrap.
#
# Prerequisites:
#   - DNS A/AAAA for server/admin/participant.brainpulses.com → this VPS
#   - Run as root from the cloned repo (or any cwd; script finds its root)
#
#   export CERTBOT_EMAIL=you@example.com
#   export TWILIO_ACCOUNT_SID=… TWILIO_AUTH_TOKEN=… TWILIO_FROM_NUMBER=…
#   sudo -E bash setup.sh
#
# Does not seed the database. Create the first admin user after setup.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_WWW="${ADMIN_WWW:-/var/www/brainpulses/admin}"
PARTICIPANT_WWW="${PARTICIPANT_WWW:-/var/www/brainpulses/participant}"
PM2_APP="${PM2_APP:-brainpulses-api}"
API_DOMAIN="${API_DOMAIN:-server.brainpulses.com}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.brainpulses.com}"
PARTICIPANT_DOMAIN="${PARTICIPANT_DOMAIN:-participant.brainpulses.com}"

cd "$REPO_ROOT"

log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root (sudo -E bash setup.sh)."
}

rand_hex() {
  openssl rand -hex "${1:-24}"
}

# Set KEY=value in a dotenv file (replace existing line or append).
set_env_kv() {
  local file="$1" key="$2" value="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]] && grep -qE "^${key}=" "$file"; then
    # shellcheck disable=SC2001
    sed "s|^${key}=.*|${key}=${value}|" "$file" >"$tmp"
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
    rm -f "$tmp"
  fi
}

get_env_kv() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  grep -E "^${key}=" "$file" | head -n1 | cut -d= -f2-
}

install_packages() {
  log "Install system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg rsync ufw openssl

  if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
    log "Install Node.js 22 (NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi

  if ! command -v docker >/dev/null 2>&1; then
    apt-get install -y docker.io docker-compose-v2
  else
    apt-get install -y docker-compose-v2 || apt-get install -y docker-compose-plugin || true
  fi
  systemctl enable --now docker

  apt-get install -y nginx certbot python3-certbot-nginx
  npm install -g pm2

  node -v
  npm -v
  docker compose version || docker-compose version
  nginx -v
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    log "ufw not installed; skip firewall"
    return 0
  fi
  log "Configure ufw (SSH, 80/tcp, 443/tcp, 443/udp)"
  ufw allow OpenSSH || ufw allow 22/tcp || true
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
  ufw --force enable || true
}

bootstrap_env() {
  log "Bootstrap env files"

  if [[ ! -f .env ]]; then
    cp .env.example .env
    local pg_pass redis_pass
    pg_pass="$(rand_hex 24)"
    redis_pass="$(rand_hex 24)"
    set_env_kv .env POSTGRES_PASSWORD "$pg_pass"
    set_env_kv .env REDIS_PASSWORD "$redis_pass"
    log "Generated POSTGRES_PASSWORD and REDIS_PASSWORD in .env"
  fi

  local pg_user pg_pass pg_db redis_pass
  pg_user="$(get_env_kv .env POSTGRES_USER || echo brainpulses)"
  pg_pass="$(get_env_kv .env POSTGRES_PASSWORD)"
  pg_db="$(get_env_kv .env POSTGRES_DB || echo brainpulses)"
  redis_pass="$(get_env_kv .env REDIS_PASSWORD)"
  [[ -n "$pg_pass" && -n "$redis_pass" ]] || die ".env missing POSTGRES_PASSWORD or REDIS_PASSWORD"

  if [[ ! -f api/.env.prod ]]; then
    cp api/.env.prod.example api/.env.prod
  fi

  set_env_kv api/.env.prod DATABASE_URL \
    "postgresql://${pg_user}:${pg_pass}@127.0.0.1:5434/${pg_db}?schema=public"
  set_env_kv api/.env.prod REDIS_URL "redis://:${redis_pass}@127.0.0.1:6381"

  local jwt
  jwt="$(get_env_kv api/.env.prod JWT_SECRET || true)"
  if [[ -z "$jwt" || "$jwt" == "replace-with-at-least-32-random-characters" || ${#jwt} -lt 32 ]]; then
    jwt="$(rand_hex 32)"
    set_env_kv api/.env.prod JWT_SECRET "$jwt"
    log "Generated JWT_SECRET in api/.env.prod"
  fi

  if [[ -n "${TWILIO_ACCOUNT_SID:-}" ]]; then
    set_env_kv api/.env.prod TWILIO_ACCOUNT_SID "$TWILIO_ACCOUNT_SID"
  fi
  if [[ -n "${TWILIO_AUTH_TOKEN:-}" ]]; then
    set_env_kv api/.env.prod TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN"
  fi
  if [[ -n "${TWILIO_FROM_NUMBER:-}" ]]; then
    set_env_kv api/.env.prod TWILIO_FROM_NUMBER "$TWILIO_FROM_NUMBER"
  fi
  set_env_kv api/.env.prod TWILIO_ENABLED true
  set_env_kv api/.env.prod NODE_ENV production
  set_env_kv api/.env.prod HOST 127.0.0.1
  set_env_kv api/.env.prod TRUST_PROXY 1
  set_env_kv api/.env.prod COOKIE_SECURE true

  local sid token from
  sid="$(get_env_kv api/.env.prod TWILIO_ACCOUNT_SID || true)"
  token="$(get_env_kv api/.env.prod TWILIO_AUTH_TOKEN || true)"
  from="$(get_env_kv api/.env.prod TWILIO_FROM_NUMBER || true)"
  if [[ -z "$sid" || "$sid" == "replace-me" || -z "$token" || "$token" == "replace-me" || -z "$from" || "$from" == "+1xxxxxxxxxx" ]]; then
    die "Twilio placeholders remain in api/.env.prod.
Export real values and re-run:
  export TWILIO_ACCOUNT_SID=…
  export TWILIO_AUTH_TOKEN=…
  export TWILIO_FROM_NUMBER=…
  sudo -E bash setup.sh
Or edit api/.env.prod directly."
  fi

  if [[ ! -f admin/.env.production ]]; then
    cp admin/.env.production.example admin/.env.production
  fi
  if [[ ! -f participant/.env.production ]]; then
    cp participant/.env.production.example participant/.env.production
  fi
}

wait_for_data_plane() {
  log "Start Docker data plane (db + redis)"
  docker compose up -d

  local i
  for i in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U "$(get_env_kv .env POSTGRES_USER || echo brainpulses)" -d "$(get_env_kv .env POSTGRES_DB || echo brainpulses)" >/dev/null 2>&1 \
      && docker compose exec -T redis redis-cli -a "$(get_env_kv .env REDIS_PASSWORD)" ping 2>/dev/null | grep -q PONG; then
      log "Postgres and Redis healthy"
      return 0
    fi
    sleep 2
  done
  die "Timed out waiting for Postgres/Redis health"
}

build_and_start_api() {
  log "Install, migrate, build API"
  npm ci --prefix api
  (
    cd api
    export NODE_ENV=production
    npx prisma migrate deploy
  )
  npm run build --prefix api
  mkdir -p api/logs api/uploads

  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    log "Reload PM2 app $PM2_APP"
    pm2 reload "$PM2_APP" --env production
  else
    log "Start PM2 app $PM2_APP"
    pm2 start "$REPO_ROOT/api/ecosystem.config.cjs" --env production
  fi
  pm2 save
  # Non-interactive systemd startup for root
  env PATH="$PATH" pm2 startup systemd -u root --hp /root >/tmp/pm2-startup.out 2>&1 || true
  if grep -q "sudo env PATH" /tmp/pm2-startup.out 2>/dev/null; then
    # shellcheck disable=SC2046
    eval $(grep -E '^sudo env PATH' /tmp/pm2-startup.out | tail -n1 | sed 's/^sudo //')
  fi
}

build_and_publish_spas() {
  log "Build and publish Admin + Participant"
  npm ci --prefix admin
  npm ci --prefix participant
  npm run build --prefix admin
  npm run build --prefix participant
  mkdir -p "$ADMIN_WWW" "$PARTICIPANT_WWW"
  rsync -a --delete "$REPO_ROOT/admin/dist/" "$ADMIN_WWW/"
  rsync -a --delete "$REPO_ROOT/participant/dist/" "$PARTICIPANT_WWW/"
}

strip_http3_if_needed() {
  local conf="$1"
  if nginx -V 2>&1 | grep -q http_v3; then
    return 0
  fi
  log "nginx lacks http_v3; stripping QUIC/HTTP/3 from $(basename "$conf")"
  local tmp
  tmp="$(mktemp)"
  grep -vE 'listen .*quic|http3 on|Alt-Svc' "$conf" >"$tmp"
  mv "$tmp" "$conf"
}

configure_tls_and_nginx() {
  [[ -n "${CERTBOT_EMAIL:-}" ]] || die "Set CERTBOT_EMAIL before running setup.sh (Let's Encrypt account email)."

  log "Obtain TLS certificates (certbot standalone)"
  systemctl stop nginx || true

  local need_cert=0
  for d in "$API_DOMAIN" "$ADMIN_DOMAIN" "$PARTICIPANT_DOMAIN"; do
    if [[ ! -f "/etc/letsencrypt/live/${d}/fullchain.pem" ]]; then
      need_cert=1
      break
    fi
  done

  if [[ "$need_cert" -eq 1 ]]; then
    certbot certonly --standalone --non-interactive --agree-tos \
      -m "$CERTBOT_EMAIL" \
      -d "$API_DOMAIN" \
      -d "$ADMIN_DOMAIN" \
      -d "$PARTICIPANT_DOMAIN"
  else
    log "Let's Encrypt certs already present; skip issuance"
  fi

  log "Install nginx site configs"
  mkdir -p /etc/nginx/conf.d
  cp "$REPO_ROOT/docs/ops/nginx/server.brainpulses.com.conf" /etc/nginx/conf.d/
  cp "$REPO_ROOT/docs/ops/nginx/admin.brainpulses.com.conf" /etc/nginx/conf.d/
  cp "$REPO_ROOT/docs/ops/nginx/participant.brainpulses.com.conf" /etc/nginx/conf.d/
  rm -f /etc/nginx/sites-enabled/default

  strip_http3_if_needed /etc/nginx/conf.d/server.brainpulses.com.conf
  strip_http3_if_needed /etc/nginx/conf.d/admin.brainpulses.com.conf
  strip_http3_if_needed /etc/nginx/conf.d/participant.brainpulses.com.conf

  nginx -t
  systemctl enable nginx
  systemctl start nginx
  systemctl reload nginx
}

smoke() {
  log "Smoke checks"
  curl -fsS "http://127.0.0.1:3002/health" | head -c 200
  echo
  curl -fsS "http://127.0.0.1:3002/health/ready" | head -c 200
  echo
  curl -sI --http2 "https://${API_DOMAIN}/health" | head -n 5 || true
  curl -sI --http2 "https://${ADMIN_DOMAIN}/" | head -n 5 || true
  curl -sI --http2 "https://${PARTICIPANT_DOMAIN}/" | head -n 5 || true
}

main() {
  require_root
  command -v apt-get >/dev/null 2>&1 || die "apt-get required (Ubuntu/Debian)."

  install_packages
  configure_firewall
  mkdir -p api/logs api/uploads "$ADMIN_WWW" "$PARTICIPANT_WWW"
  bootstrap_env
  wait_for_data_plane
  build_and_start_api
  build_and_publish_spas
  configure_tls_and_nginx
  smoke

  cat <<EOF

Setup complete.

  API:          https://${API_DOMAIN}
  Admin:        https://${ADMIN_DOMAIN}
  Participant:  https://${PARTICIPANT_DOMAIN}

Create the first admin user manually (no production seed).
Later updates:
  sudo bash update-deploy.sh --pull

Details: docs/ops/DEPLOY.md
EOF
}

main "$@"
