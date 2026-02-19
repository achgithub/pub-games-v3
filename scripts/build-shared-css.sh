#!/bin/bash
# Build the shared Activity Hub CSS from the Tailwind source.
# Run on the Pi after changing activity-hub-src.css or tailwind.config.js.
# The output (activity-hub.css) should be committed to the repo.
#
# Usage:
#   bash ~/pub-games-v3/scripts/build-shared-css.sh

set -e

STYLES_DIR=~/pub-games-v3/lib/activity-hub-common/styles

echo "Installing Tailwind (if needed)..."
cd "$STYLES_DIR"
npm install --silent

echo "Building activity-hub.css..."
npm run build

echo ""
echo "Done. Output: identity-shell/backend/static/activity-hub.css"
echo "Commit the updated CSS file and restart identity-shell to serve it."
