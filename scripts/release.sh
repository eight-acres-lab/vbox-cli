#!/usr/bin/env bash
# Release a new vbox-cli version to npm.
#
#   ./scripts/release.sh 0.3.2          # bump, test, build, publish
#   ./scripts/release.sh 0.3.2 --dry-run
#
# Refuses to run with an unclean working tree.

set -euo pipefail

VERSION="${1:-}"
DRY_RUN=""
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ -z "$VERSION" ]]; then
  echo "usage: $0 <version> [--dry-run]" >&2
  echo "       e.g. $0 0.3.2" >&2
  exit 2
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$ ]]; then
  echo "version must look like 0.3.2 or 0.3.2-rc1, got: $VERSION" >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree is dirty; commit or stash first" >&2
  git status --short
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="v$VERSION"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "tag $TAG already exists" >&2
  exit 1
fi

echo "==> bumping package.json + src/cli.ts to $VERSION"
npm version "$VERSION" --no-git-tag-version --allow-same-version > /dev/null
# src/cli.ts has a duplicate VERSION constant — keep it in sync
sed -i.bak -E "s/^const VERSION = \"[^\"]+\"\$/const VERSION = \"$VERSION\"/" src/cli.ts
rm -f src/cli.ts.bak

echo "==> install + typecheck + test"
npm ci > /dev/null
npm run typecheck
npm test

echo "==> build"
npm run build

if [[ -n "$DRY_RUN" ]]; then
  echo "==> --dry-run: showing what would be published"
  npm publish --dry-run
  echo "==> --dry-run; not committing, tagging, or publishing"
  git checkout -- package.json package-lock.json src/cli.ts 2>/dev/null || true
  exit 0
fi

echo "==> committing version bump (if needed)"
git add package.json package-lock.json src/cli.ts
if git diff --cached --quiet; then
  echo "    (no version-bump changes — already at $VERSION)"
else
  git commit -s -m "chore: release $VERSION"
fi

echo "==> tagging $TAG"
git tag -a "$TAG" -m "Release $TAG"
git push origin main "$TAG"

echo "==> npm publish"
npm publish --access public

echo "==> done. https://www.npmjs.com/package/@e8s/vbox-cli/v/$VERSION"
