#!/usr/bin/env bash
# Build the alleycat host sidecar binary for the current platform.
# Output lands in bin/ (gitignored).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIDECAR_DIR="$SCRIPT_DIR/sidecar"
BIN_DIR="$SCRIPT_DIR/bin"

TARGET="${1:-aarch64-apple-darwin}"

echo "Building neon-pilot-alleycat-host for $TARGET..."
cargo build --manifest-path "$SIDECAR_DIR/Cargo.toml" --release --target "$TARGET"

mkdir -p "$BIN_DIR"

# Map Rust target triple to the binary name used by the extension
case "$TARGET" in
  aarch64-apple-darwin)  BINARY_NAME="neon-pilot-alleycat-host-macos-arm64" ;;
  x86_64-apple-darwin)   BINARY_NAME="neon-pilot-alleycat-host-macos-x64"   ;;
  *)                     BINARY_NAME="neon-pilot-alleycat-host-$TARGET"      ;;
esac

cp "$SIDECAR_DIR/target/$TARGET/release/neon-pilot-alleycat-host" "$BIN_DIR/$BINARY_NAME"
echo "Done → $BIN_DIR/$BINARY_NAME"
