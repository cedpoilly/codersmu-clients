#!/bin/zsh

set -euo pipefail

SCRIPT_DIR=${0:A:h}
MACOS_DIR=${SCRIPT_DIR:h}
ROOT_DIR=${MACOS_DIR:h:h}
PROJECT_SPEC="${MACOS_DIR}/project.yml"
PROJECT_FILE="${MACOS_DIR}/CodersmuMenuBar.xcodeproj"
DERIVED_DIR="${MACOS_DIR}/build-derived"
APP_BUNDLE="${DERIVED_DIR}/Build/Products/Debug/CodersmuMenuBar.app"
APP_BINARY="${APP_BUNDLE}/Contents/MacOS/CodersmuMenuBar"

if [[ "${1:-}" == "--clean" ]]; then
  rm -rf "${DERIVED_DIR}"
fi

# Full Xcode works here; prefer it over Command Line Tools if both are installed.
if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

cd "${ROOT_DIR}"

xcodegen generate --spec "${PROJECT_SPEC}"

xcodebuild \
  -project "${PROJECT_FILE}" \
  -scheme CodersmuMenuBar \
  -configuration Debug \
  -derivedDataPath "${DERIVED_DIR}" \
  build

pkill -f '/CodersmuMenuBar.app/Contents/MacOS/CodersmuMenuBar' || true
if ! open "${APP_BUNDLE}"; then
  "${APP_BINARY}" >/tmp/codersmu-macos-dev.log 2>&1 &
fi
sleep 2

echo "Launched:"
pgrep -fl "${APP_BINARY}" || true
