#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_PATH="${ROOT_DIR}/apps/macos/CodersmuMenuBar.xcodeproj"
SCHEME="CodersmuMenuBar"
CONFIGURATION="${CODERSMU_MACOS_CONFIGURATION:-Release}"
OUTPUT_DIR="${CODERSMU_MACOS_OUTPUT_DIR:-${ROOT_DIR}/apps/macos/dist}"
BUNDLE_NAME="CodersmuMenuBar.app"
TEAM_ID="${APPLE_TEAM_ID:-${CODERSMU_MACOS_TEAM_ID:-}}"
SIGNING_IDENTITY="${CODERSMU_MACOS_SIGNING_IDENTITY:-Developer ID Application}"
NOTARY_KEY_PATH="${APP_STORE_CONNECT_KEY_PATH:-${CODERSMU_MACOS_NOTARY_KEY_PATH:-}}"
NOTARY_KEY_ID="${APP_STORE_CONNECT_KEY_ID:-${CODERSMU_MACOS_NOTARY_KEY_ID:-}}"
NOTARY_ISSUER_ID="${APP_STORE_CONNECT_ISSUER_ID:-${CODERSMU_MACOS_NOTARY_ISSUER_ID:-}}"
SKIP_NOTARIZATION="${CODERSMU_MACOS_SKIP_NOTARIZATION:-0}"
ARTIFACT_LABEL="${CODERSMU_MACOS_ARTIFACT_LABEL:-}"

function fail() {
  echo "error: $*" >&2
  exit 1
}

function require_var() {
  local name="$1"
  local value="$2"

  if [[ -z "${value}" ]]; then
    fail "${name} is required"
  fi
}

require_var "APPLE_TEAM_ID or CODERSMU_MACOS_TEAM_ID" "${TEAM_ID}"

MARKETING_VERSION="$(
  xcodebuild -showBuildSettings \
    -project "${PROJECT_PATH}" \
    -scheme "${SCHEME}" \
    -configuration "${CONFIGURATION}" 2>/dev/null |
    awk '/MARKETING_VERSION = / { print $3; exit }'
)"

CURRENT_PROJECT_VERSION="$(
  xcodebuild -showBuildSettings \
    -project "${PROJECT_PATH}" \
    -scheme "${SCHEME}" \
    -configuration "${CONFIGURATION}" 2>/dev/null |
    awk '/CURRENT_PROJECT_VERSION = / { print $3; exit }'
)"

require_var "MARKETING_VERSION" "${MARKETING_VERSION}"
require_var "CURRENT_PROJECT_VERSION" "${CURRENT_PROJECT_VERSION}"

ARTIFACT_BASENAME="${ARTIFACT_LABEL:-CodersmuMenuBar-${MARKETING_VERSION}-${CURRENT_PROJECT_VERSION}}"
TEMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TEMP_DIR}/${ARTIFACT_BASENAME}.xcarchive"
EXPORT_PATH="${TEMP_DIR}/export"
APP_PATH="${EXPORT_PATH}/${BUNDLE_NAME}"
EXPORT_OPTIONS_PLIST="${TEMP_DIR}/export-options.plist"
NOTARY_SUBMISSION_ZIP="${TEMP_DIR}/${ARTIFACT_BASENAME}-notary.zip"
FINAL_ZIP_PATH="${OUTPUT_DIR}/${ARTIFACT_BASENAME}.zip"
DSYM_PATH="${ARCHIVE_PATH}/dSYMs/CodersmuMenuBar.app.dSYM"
DSYM_ZIP_PATH="${OUTPUT_DIR}/${ARTIFACT_BASENAME}.dSYM.zip"

cleanup() {
  rm -rf "${TEMP_DIR}"
}

trap cleanup EXIT

mkdir -p "${OUTPUT_DIR}"

cat > "${EXPORT_OPTIONS_PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>method</key>
  <string>developer-id</string>
  <key>signingCertificate</key>
  <string>${SIGNING_IDENTITY}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
</dict>
</plist>
EOF

echo "Archiving ${SCHEME} (${CONFIGURATION})..."
xcodebuild archive \
  -project "${PROJECT_PATH}" \
  -scheme "${SCHEME}" \
  -configuration "${CONFIGURATION}" \
  -destination "generic/platform=macOS" \
  -archivePath "${ARCHIVE_PATH}" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="${SIGNING_IDENTITY}" \
  DEVELOPMENT_TEAM="${TEAM_ID}" \
  ENABLE_HARDENED_RUNTIME=YES

echo "Exporting Developer ID package..."
xcodebuild -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS_PLIST}"

[[ -d "${APP_PATH}" ]] || fail "Expected exported app at ${APP_PATH}"

echo "Verifying code signature..."
codesign --verify --deep --strict --verbose=2 "${APP_PATH}"

if [[ "${SKIP_NOTARIZATION}" != "1" ]]; then
  require_var "APP_STORE_CONNECT_KEY_PATH or CODERSMU_MACOS_NOTARY_KEY_PATH" "${NOTARY_KEY_PATH}"
  require_var "APP_STORE_CONNECT_KEY_ID or CODERSMU_MACOS_NOTARY_KEY_ID" "${NOTARY_KEY_ID}"

  if [[ ! -f "${NOTARY_KEY_PATH}" ]]; then
    fail "Notary key file not found at ${NOTARY_KEY_PATH}"
  fi

  echo "Preparing notarization upload..."
  ditto -c -k --keepParent "${APP_PATH}" "${NOTARY_SUBMISSION_ZIP}"

  NOTARY_COMMAND=(
    xcrun
    notarytool
    submit
    "${NOTARY_SUBMISSION_ZIP}"
    --key
    "${NOTARY_KEY_PATH}"
    --key-id
    "${NOTARY_KEY_ID}"
    --wait
  )

  if [[ -n "${NOTARY_ISSUER_ID}" ]]; then
    NOTARY_COMMAND+=(--issuer "${NOTARY_ISSUER_ID}")
  fi

  echo "Submitting for notarization..."
  "${NOTARY_COMMAND[@]}"

  echo "Stapling notarization ticket..."
  xcrun stapler staple "${APP_PATH}"
  xcrun stapler validate "${APP_PATH}"
else
  echo "Skipping notarization because CODERSMU_MACOS_SKIP_NOTARIZATION=1"
fi

echo "Writing final zip artifact..."
ditto -c -k --keepParent "${APP_PATH}" "${FINAL_ZIP_PATH}"

if [[ -d "${DSYM_PATH}" ]]; then
  echo "Writing dSYM zip artifact..."
  ditto -c -k --keepParent "${DSYM_PATH}" "${DSYM_ZIP_PATH}"
fi

echo "Created ${FINAL_ZIP_PATH}"
if [[ -f "${DSYM_ZIP_PATH}" ]]; then
  echo "Created ${DSYM_ZIP_PATH}"
fi
