#!/usr/bin/env bash
# Interactively write Brevo (or any) SMTP credentials into server/.env.
#
# Run it on the server:   bash server/setup-mail.sh
#
# The SMTP key is read with `read -s`, so it is never echoed to the screen and
# never lands in your shell history.
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "No .env at $ENV_FILE"; exit 1; }

echo "=== Brevo SMTP setup for complaint.website ==="
echo
echo "Find these in Brevo:  SMTP & API  ->  SMTP tab"
echo "  Login is like  9xxxxxx001@smtp-brevo.com  (NOT your account email)"
echo "  Key   is like  xsmtpsib-...               (NOT the xkeysib- API key)"
echo

read -r  -p "SMTP login: " SMTP_LOGIN
read -rs -p "SMTP key (hidden): " SMTP_KEY; echo
read -r  -p "Send emails from [noreply@complaint.website]: " FROM_ADDR
FROM_ADDR="${FROM_ADDR:-noreply@complaint.website}"

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
set_var RESEND_API_KEY ""   # keep empty so the SMTP path is the one used

chmod 600 "$ENV_FILE"
chown complaint:complaint "$ENV_FILE" 2>/dev/null || true

echo
echo "Saved. Restarting the service…"
systemctl restart complaint
sleep 2
systemctl is-active complaint && journalctl -u complaint -n 3 --no-pager | tail -2
echo
echo "Now send yourself a test:  node server/test-mail.js you@example.com"
