#!/usr/bin/env bash
set -e

# ==============================================================================
# Automated Release Script for Warhammer 3 Mod Manager
# Usage:
#   ./scripts/release.sh patch
#   ./scripts/release.sh minor
#   ./scripts/release.sh major
#   ./scripts/release.sh 2.1.0
# ==============================================================================

if [ -z "$1" ]; then
    echo "❌ Error: Version argument required (e.g. ./scripts/release.sh patch, minor, major, or 2.1.0)"
    exit 1
fi

VERSION_ARG=$1

# Ensure clean working tree
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️ Warning: You have uncommitted changes. Please commit or stash them before releasing."
    git status --short
    exit 1
fi

# Run version bump
node scripts/bump_version.js "$VERSION_ARG"

# Extract new version
NEW_VER=$(node -p "require('./package.json').version")

# Run build verification
echo "🔍 Running build and test verification..."
npm run typecheck
npm run build
cargo test --manifest-path src-tauri/Cargo.toml

# Commit and Tag
echo "🏷️ Creating Git Commit and Tag v$NEW_VER..."
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore(release): bump version to v$NEW_VER"
git tag "v$NEW_VER"

echo ""
echo "🚀 Release v$NEW_VER created locally!"
echo "To trigger the automated GitHub Actions build and release, run:"
echo "    git push origin main --tags"
echo ""
