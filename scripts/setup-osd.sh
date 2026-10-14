#!/usr/bin/env bash
# OpenSearch Dashboards 本体を隣のディレクトリに clone し、
# このプラグインを plugins/ 配下にシンボリックリンクして開発環境を整える。
#
# 使い方:
#   ./scripts/setup-osd.sh [OSD_VERSION] [OSD_DIR]
#   例: ./scripts/setup-osd.sh 3.9.0 ../OpenSearch-Dashboards
set -euo pipefail

OSD_VERSION="${1:-3.9.0}"
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_NAME="$(basename "$PLUGIN_DIR")"
OSD_DIR="${2:-$(dirname "$PLUGIN_DIR")/OpenSearch-Dashboards}"

echo "Plugin   : $PLUGIN_DIR"
echo "OSD      : $OSD_DIR (tag $OSD_VERSION)"

if [ ! -d "$OSD_DIR/.git" ]; then
  git clone --depth 1 --branch "$OSD_VERSION" \
    https://github.com/opensearch-project/OpenSearch-Dashboards.git "$OSD_DIR"
fi

REQUIRED_NODE="$(cat "$OSD_DIR/.nvmrc")"
CURRENT_NODE="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$REQUIRED_NODE" != "$CURRENT_NODE" ]; then
  echo "WARNING: OSD $OSD_VERSION requires Node $REQUIRED_NODE but current is $(node -v)."
  echo "         Run: nvm install $REQUIRED_NODE && nvm use $REQUIRED_NODE"
fi

mkdir -p "$OSD_DIR/plugins"
LINK="$OSD_DIR/plugins/$PLUGIN_NAME"
if [ ! -e "$LINK" ]; then
  ln -s "$PLUGIN_DIR" "$LINK"
  echo "Linked   : $LINK -> $PLUGIN_DIR"
fi

(cd "$OSD_DIR" && yarn osd bootstrap)

cat <<EOF

Done. Next steps:
  1. Start OpenSearch:          docker compose -f "$PLUGIN_DIR/docker-compose.yml" up -d
  2. Start Dashboards (dev):    (cd "$OSD_DIR" && yarn start --no-base-path)
  3. Open http://localhost:5601 and find "$PLUGIN_NAME" in the left nav.
EOF
