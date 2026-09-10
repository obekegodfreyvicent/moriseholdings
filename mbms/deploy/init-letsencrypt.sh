#!/usr/bin/env bash
# One-time bootstrap for Let's Encrypt certificates on a self-hosted / VPS
# deployment of the MBMS stack. See the root README's "SSL / TLS
# certificates (Let's Encrypt)" section for the full walkthrough. Safe to
# re-run — it skips any domain that already has a live certificate, since
# renewal after that is handled by the long-running certbot service in
# docker-compose.ssl.yml, not by this script.
#
# Prerequisites: docker + the docker compose plugin; mbms/deploy/.env.ssl
# filled in from .env.ssl.example with real domain names and a real
# e-mail address; DNS A/AAAA records for all three domains already
# pointing at this host; ports 80 and 443 reachable from the internet.
#
# Adapted from the standard certbot-with-nginx-in-docker-compose pattern:
# nginx cannot start an `ssl_certificate` server block pointed at a file
# that doesn't exist yet, so a throwaway self-signed "dummy" certificate
# is created first just so nginx will start and serve the ACME HTTP-01
# challenge; it is then replaced with the real certificate from Let's
# Encrypt.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env.ssl ]; then
  echo "Missing mbms/deploy/.env.ssl — copy .env.ssl.example to .env.ssl and fill in real domains/email first." >&2
  exit 1
fi
# shellcheck disable=SC1091
source .env.ssl

COMPOSE="docker compose -f ../docker-compose.yml -f docker-compose.ssl.yml"
DATA_PATH="./certbot"
STAGING="${STAGING:-0}"
staging_arg=""
[ "$STAGING" != "0" ] && staging_arg="--staging"

mkdir -p "$DATA_PATH/conf" "$DATA_PATH/www"

NEW_DOMAINS=()
for domain in "$ADMIN_DOMAIN" "$STOREFRONT_DOMAIN" "$API_DOMAIN"; do
  if [ -d "$DATA_PATH/conf/live/$domain" ]; then
    echo "Certificate for $domain already exists — skipping issuance (renewal is handled by the certbot service)."
  else
    NEW_DOMAINS+=("$domain")
  fi
done

if [ ${#NEW_DOMAINS[@]} -eq 0 ]; then
  echo "All three domains already have certificates. Nothing to do."
  exit 0
fi

for domain in "${NEW_DOMAINS[@]}"; do
  echo "### Creating a dummy certificate for $domain, so nginx can start ..."
  path="/etc/letsencrypt/live/$domain"
  $COMPOSE run --rm --entrypoint "sh -c \"mkdir -p $path && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout $path/privkey.pem -out $path/fullchain.pem -subj '/CN=localhost'\"" certbot
done

echo "### Starting nginx-proxy on the dummy certificates ..."
$COMPOSE up -d nginx-proxy

for domain in "${NEW_DOMAINS[@]}"; do
  echo "### Deleting the dummy certificate for $domain ..."
  $COMPOSE run --rm --entrypoint "rm -Rf /etc/letsencrypt/live/$domain /etc/letsencrypt/archive/$domain /etc/letsencrypt/renewal/$domain.conf" certbot

  echo "### Requesting the real Let's Encrypt certificate for $domain ..."
  $COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot $staging_arg --email $LETSENCRYPT_EMAIL -d $domain --rsa-key-size 4096 --agree-tos --no-eff-email --force-renewal" certbot
done

echo "### Reloading nginx-proxy with the real certificates ..."
$COMPOSE exec nginx-proxy nginx -s reload

echo "Done. Issued Let's Encrypt certificates for: ${NEW_DOMAINS[*]}"
echo "Auto-renewal now runs from the certbot service's loop (docker-compose.ssl.yml) — no host cron needed."
