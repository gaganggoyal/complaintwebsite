#!/usr/bin/env bash
# Interactively write Brevo (or any) SMTP credentials into server/.env.
#
# Run it from the server's app directory:   bash server/setup-mail.sh
#
# Override the systemd unit and owner if yours differ:
#   SERVICE=my-unit APP_USER=my-user bash server/setup-mail.sh
#
# The SMTP key is read with `read -s`, so it is never echoed to the screen and
# never lands in your shell history.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
[ -f "$ENV_FILE" ] || { echo "No .env at $ENV_FILE"; exit 1; }

# Deployment-specific; override via the environment rather than editing this.
SERVICE="${SERVICE:-complaint}"
APP_USER="${APP_USER:-}"

echo "=== Brevo SMTP setup for complaint.website ==="
echo
echo "Find these in Brevo:  SMTP & API  ->  SMTP tab"
echo "  Login is like  9xxxxxx001@smtp-brevo.com  (NOT your account email)"
echo "  Key   is like  xsmtpsib-...               (NOT the xkeysib- API key)"
echo

read -r  -p "SMTP login: " SMTP_LOGIN
read -rs -p "SMTP key (hidden): " SMTP_KEY; echo

echo
echo "The FROM address must be on a domain authenticated with Brevo."
echo "DMARC is checked against this domain, so a gmail.com / yahoo.com"
echo "address here fails alignment and gets filtered as spoofing."
read -r  -p "Send emails FROM [noreply@complaint.website]: " FROM_ADDR
FROM_ADDR="${FROM_ADDR:-noreply@complaint.website}"

case "$FROM_ADDR" in
  *@gmail.com|*@googlemail.com|*@yahoo.com|*@outlook.com|*@hotmail.com)
    echo
    echo "⚠️  '$FROM_ADDR' is a free-mail address. Verification codes sent from it"
    echo "    will fail DMARC and are likely to land in spam."
    read -r -p "    Use it anyway? [y/N]: " CONFIRM
    [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || { echo "Aborted — nothing changed."; exit 1; }
    ;;
esac

echo
echo "Replies go here. complaint.website has no MX record, so without this a"
echo "customer hitting Reply gets a bounce. Blank = no Reply-To header."
read -r  -p "Reply-To address [none]: " REPLY_ADDR

[ -n "$SMTP_LOGIN" ] && [ -n "$SMTP_KEY" ] || { echo "Login and key are both required."; exit 1; }

cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"

# Replace a KEY=value line in place, whatever its current value.
set_var() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines(True)
with open(path, 'w') as f:
    for line in lines:
        f.write(f"{key}={val}\n" if line.startswith(key + "=") else line)
PY
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

set_var SMTP_HOST   "smtp-relay.brevo.com"
set_var SMTP_PORT   "587"
set_var SMTP_SECURE "false"
set_var SMTP_USER   "$SMTP_LOGIN"
set_var SMTP_PASS   "$SMTP_KEY"
set_var MAIL_FROM   "complaint.website <${FROM_ADDR}>"
set_var MAIL_REPLY_TO "${REPLY_ADDR}"
set_var RESEND_API_KEY ""   # keep empty so the SMTP path is the one used

chmod 600 "$ENV_FILE"
[ -n "$APP_USER" ] && chown "$APP_USER:$APP_USER" "$ENV_FILE" 2>/dev/null

echo
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SERVICE.service" >/dev/null 2>&1; then
  echo "Saved. Restarting $SERVICE…"
  systemctl restart "$SERVICE"
  sleep 2
  systemctl is-active "$SERVICE" && journalctl -u "$SERVICE" -n 3 --no-pager | tail -2
else
  echo "Saved. Restart the app for the new settings to take effect."
fi

echo
echo "Now send yourself a test:  node $SCRIPT_DIR/test-mail.js you@example.com"
