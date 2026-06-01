#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/dist-mobile"

rm -rf "$WEB_DIR"
mkdir -p "$WEB_DIR"

cp "$ROOT_DIR/index.html" "$WEB_DIR/index.html"
cp "$ROOT_DIR/privacy.html" "$WEB_DIR/privacy.html"
cp "$ROOT_DIR/delete-account.html" "$WEB_DIR/delete-account.html"
cp "$ROOT_DIR/styles.css" "$WEB_DIR/styles.css"
cp "$ROOT_DIR/app.js" "$WEB_DIR/app.js"
cp "$ROOT_DIR/site.webmanifest" "$WEB_DIR/site.webmanifest"
cp "$ROOT_DIR/favicon.ico" "$WEB_DIR/favicon.ico"
cp -R "$ROOT_DIR/assets" "$WEB_DIR/assets"

echo "Prepared Capacitor web assets in dist-mobile."
