#!/usr/bin/env bash
set -euo pipefail

# Codemagic Code Signing Identities are intentionally not required. This workflow
# accepts the same credentials as encrypted environment variables so a missing
# identity reference cannot stop the build before scripts start.
if [ -n "${CM_KEYSTORE:-}" ]; then
  : "${CM_KEYSTORE_PATH:=$CM_BUILD_DIR/codemagic.keystore}"
  export CM_KEYSTORE_PATH
  mkdir -p "$(dirname "$CM_KEYSTORE_PATH")"
  printf '%s' "$CM_KEYSTORE" | base64 --decode > "$CM_KEYSTORE_PATH"
fi

for variable in CM_KEYSTORE_PATH CM_KEYSTORE_PASSWORD CM_KEY_ALIAS CM_KEY_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "Missing $variable. Add CM_KEYSTORE (base64 keystore), CM_KEYSTORE_PASSWORD, CM_KEY_ALIAS and CM_KEY_PASSWORD as encrypted Codemagic environment variables." >&2
    exit 1
  fi
done

test -f "$CM_KEYSTORE_PATH" || { echo "Keystore file is missing: $CM_KEYSTORE_PATH" >&2; exit 1; }
