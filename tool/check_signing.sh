#!/usr/bin/env bash
set -euo pipefail
for variable in CM_KEYSTORE_PATH CM_KEYSTORE_PASSWORD CM_KEY_ALIAS CM_KEY_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "Missing $variable. Configure nativeforge_upload in Codemagic Code signing identities. Use android-debug for an unsigned-store test APK." >&2
    exit 1
  fi
done
test -f "$CM_KEYSTORE_PATH" || { echo "Keystore file is missing" >&2; exit 1; }
