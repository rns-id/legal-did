#!/bin/bash
# Build Anchor program and fix IDL format for browser compatibility
# Usage: ./build-and-fix-idl.sh

set -e

echo "🔨 Building Anchor program..."
anchor build

echo "🔧 Fixing IDL format (adding version field)..."
cat target/idl/legaldid.json | jq '. + {version: .metadata.version}' > target/idl/legaldid-temp.json
mv target/idl/legaldid-temp.json target/idl/legaldid.json

echo "✅ Build complete and IDL fixed!"
echo ""
echo "📋 IDL Info:"
cat target/idl/legaldid.json | jq '{version, address, metadata}'
echo ""
echo "📁 IDL Location: target/idl/legaldid.json"
echo "🌐 Ready to upload to Solana Explorer or Anchor Playground"
