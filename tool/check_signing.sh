#!/usr/bin/env bash
set -euo pipefail

# Codemagic Code Signing Identities are intentionally not required. This workflow
# accepts the same credentials as encrypted environment variables so a missing
# identity reference cannot stop the build before scripts start.
if [ -n "${CM_KEYSTORE:-}" ]; then
  : "${CM_KEYSTORE_PATH:=${CM_BUILD_DIR:-$PWD}/codemagic.keystore}"
  export CM_KEYSTORE_PATH
  mkdir -p "$(dirname "$CM_KEYSTORE_PATH")"
  # Decode without putting key material in command arguments or build logs.
  python3 - <<'KEYSTORE'
import base64, binascii, os, pathlib
try:
    data = base64.b64decode(''.join(os.environ['CM_KEYSTORE'].split()), validate=True)
    if not data:
        raise ValueError('empty')
except (ValueError, binascii.Error):
    raise SystemExit('CM_KEYSTORE must contain a non-empty base64-encoded keystore.')
path = pathlib.Path(os.environ['CM_KEYSTORE_PATH'])
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'wb') as output:
    output.write(data)
os.chmod(path, 0o600)
KEYSTORE
fi

for variable in CM_KEYSTORE_PATH CM_KEYSTORE_PASSWORD CM_KEY_ALIAS CM_KEY_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "Missing $variable. Add CM_KEYSTORE (base64 keystore), CM_KEYSTORE_PASSWORD, CM_KEY_ALIAS and CM_KEY_PASSWORD as encrypted Codemagic environment variables." >&2
    exit 1
  fi
done

test -f "$CM_KEYSTORE_PATH" || { echo "Keystore file is missing: $CM_KEYSTORE_PATH" >&2; exit 1; }
