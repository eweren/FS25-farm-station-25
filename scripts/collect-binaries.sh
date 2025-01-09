#!/bin/bash -e
set -o pipefail

cd "$(dirname "$0")/.." || exit


VERSION=$(node -p "require('./package.json').version")

if [ ! -d artifacts ]; then
  mkdir artifacts
fi

mv src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe artifacts/
