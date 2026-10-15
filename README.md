# opensearch-dsl-notebook

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Adds a **Notebook** tab to OpenSearch Dashboards Dev Tools. Run Query DSL in Jupyter-style cells, mix in Markdown, save notebooks, and share them as files.

## Features

- **DSL cells** — HTTP method dropdown, path, JSON body editor with highlighting. Shift+Enter to run, **Run all** for the whole notebook
- **Markdown cells** — double-click to edit, Shift+Enter to render
- **Paste from Console** — paste `GET index/_search` + body into a cell and it is split into method / path / body. Paste several requests at once to get one cell each, executed in order
- **Output** — status, duration, raw JSON, and a **Table** view for `_search` hits and `_cat/*?format=json`-style arrays (resizable columns, sorting, pagination, expand a cell to see nested JSON)
- **Save** — notebooks are Dashboards saved objects, so tenants, permissions and Saved Objects export/import work as usual
- **Export / Import** — download as `<title>.osnb.json` (with or without outputs) and import later
- Work in progress is kept in `localStorage`, so switching tabs or reloading does not lose it

## Usage

1. Open **Dev Tools › Notebook** (`/app/dev_tools#/notebook`)
2. Type a request, or paste one from Console:
   ```
   PUT books
   { "mappings": { "properties": { "title": { "type": "text" } } } }

   POST books/_bulk?refresh=true
   { "index": { "_id": "1" } }
   { "title": "OpenSearch in Action" }

   POST books/_search
   { "query": { "match": { "title": "opensearch" } } }
   ```
3. Shift+Enter runs a cell; switch the output to **Table** when the response is tabular
4. **Save** to keep it in Dashboards, or **Export** to download a file

## Install

Requires a self-managed OpenSearch Dashboards (Amazon OpenSearch Service's bundled Dashboards does not accept custom plugins). The plugin version must match Dashboards down to the patch level.

```bash
# build (inside the Dashboards checkout, plugins/opensearch-notebook)
yarn build --opensearch-dashboards-version 3.9.0

# install on the target Dashboards
./bin/opensearch-dashboards-plugin install file:///path/to/opensearchNotebook-3.9.0.zip
```

## Development

```bash
nvm use 22
./scripts/setup-osd.sh 3.9.0        # clones Dashboards next to this repo, moves the plugin under plugins/, bootstraps
docker compose up -d                 # local OpenSearch on :9200 (skip if you have one)
cd ../OpenSearch-Dashboards && yarn start --no-base-path
```

Lint with the Dashboards toolchain: `OSD_ROOT=$PWD node scripts/eslint plugins/opensearch-notebook/{public,server,common}`.

## Limitations

- Requests go to the Dashboards default connection (no multiple data sources)
- No variables between cells, no Console autocomplete, no table view for `aggregations`
- `.osnb.json` is not compatible with Observability Notebooks

## License

Apache License 2.0. See [LICENSE](LICENSE).
