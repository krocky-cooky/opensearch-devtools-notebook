# opensearch-dsl-notebook

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

An OpenSearch Dashboards plugin that adds a **Notebook** tab to Dev Tools, next to Console and Query Profiler.
Write and run Query DSL (any REST request) in Jupyter-style cells, mix in Markdown, save the result as a notebook, and share it as a file.

![tabs](https://img.shields.io/badge/Dev%20Tools-Console%20%7C%20Query%20Profiler%20%7C%20Notebook-blue)

## Features

- **Cells**
  - `DSL` cell: HTTP method dropdown (GET / POST / PUT / DELETE / HEAD / PATCH), request path, and a JSON body editor (Monaco, with syntax highlighting)
  - `Markdown` cell: rendered with EUI Markdown. Double-click to edit, Shift+Enter to render
  - Add / delete / reorder cells, run a cell with Shift+Enter, or run every cell top to bottom with **Run all**
  - **Paste from Console**: paste `GET posts/_search` followed by a JSON body into a cell (path field or body) and it is split into method / path / body. Pasting several requests at once creates one cell per request. `#` and `//` comment lines are ignored
  - **Copy as Console request** copies a cell back into Console format
  - The notebook you are editing is kept in `localStorage`, so it survives switching Dev Tools tabs and page reloads (same behavior as Console)
- **Output**
  - Status code, duration and timestamp, plus the raw JSON response (collapsible, copyable)
  - **Table view** for `_search` results (`hits.hits` with `_source` flattened) and for responses whose top level is an array of objects (`_cat/*?format=json`, `_tasks`, …)
  - 4xx / 5xx responses are shown as cell output rather than thrown
- **Save**: notebooks are stored as Dashboards saved objects (type `opensearch-notebook`) in the `.kibana` index
  - **Open** lists saved notebooks (open / delete); **Save as copy** duplicates
  - Tenant isolation, permissions and export/import from *Stack Management › Saved Objects* come for free
  - Deep link: `/app/dev_tools#/notebook?id=<savedObjectId>`
- **File export / import**: download a notebook as `<title>.osnb.json` and import it later from the file picker
  - Choose whether to include cell outputs when exporting

## Layout

```
opensearch_dashboards.json   # id: opensearchNotebook, requiredPlugins: devTools, opensearchDashboardsReact
common/
  index.ts                   # Types (Notebook / NotebookCell / CellOutput …) and constants (routes, saved object type, file extension)
  notebook_file.ts           # Parse / build / validate the .osnb.json format
  console_request.ts         # Console-format text <-> {method, path, body}
public/
  plugin.ts                  # devTools.register({ id: 'notebook', ... })
  application.tsx            # React mount (OpenSearchDashboardsContextProvider supplies uiSettings to CodeEditor)
  dsl_language.ts            # Monarch JSON grammar for the body editor (OSD's Monaco build ships no json tokenizer)
  storage.ts                 # Saved-objects client wrapper, file download / read
  components/
    notebook_app.tsx         # Toolbar (New / Open / Save / Export / Import / Run all / Clear outputs) and the cell list
    cell.tsx                 # DSL cell (method <select>, path, Monaco) / Markdown cell
    cell_output.tsx          # Status badge, JSON view, table view
    saved_notebooks_flyout.tsx
server/
  plugin.ts                  # Saved object type registration + routes
  saved_objects.ts           # Type 'opensearch-notebook' (title / description / cells as a JSON string / schemaVersion)
  routes/index.ts            # POST /api/opensearch_notebook/execute
translations/ja-JP.json
scripts/setup-osd.sh         # Development environment setup
docker-compose.yml           # Local OpenSearch for development (security disabled)
```

### Request execution path

```
Browser ──POST /api/opensearch_notebook/execute {method,path,body}──▶ Dashboards server
        ◀── 200 {statusCode, body, durationMs} ───────────────────────  │
                                 opensearch.client.asCurrentUser.transport.request(...) ──▶ OpenSearch
```

- Any method and path is forwarded (equivalent to Console). Everything after `?` is sent as the query string
- Requests run with the permissions of the logged-in user (fine-grained access control applies as usual)
- 400 / 401 / 403 / 404 / 405 / 409 / 429 are returned with their status and body instead of being raised. 5xx and connection failures are also wrapped in a 200 `{statusCode, body}` so the cell can display them

### File format (`.osnb.json`)

```json
{
  "schemaVersion": 1,
  "title": "My notebook",
  "description": "optional",
  "exportedAt": "2026-10-14T14:00:00.000Z",
  "cells": [
    { "id": "…", "type": "markdown", "markdown": "# Title" },
    {
      "id": "…",
      "type": "dsl",
      "request": { "method": "POST", "path": "posts/_search", "body": "{\"query\":{\"match_all\":{}}}" },
      "output": { "statusCode": 200, "body": { "hits": {} }, "durationMs": 12, "executedAt": "…" }
    }
  ]
}
```

`output` is optional (it can be stripped on export). Import validates `schemaVersion`, `type`, `request.method` and so on, and rejects invalid files with a reason.

## Development setup

The plugin must live under the Dashboards checkout as a **real directory** in `plugins/` — a symlink there breaks server-side resolution of `@osd/config-schema`.
`setup-osd.sh` moves this repository to `../OpenSearch-Dashboards/plugins/opensearch-notebook` and leaves a symlink at the original location.

```bash
# Match the Node version in the Dashboards .nvmrc (3.9.0 uses Node 22)
nvm install 22 && nvm use 22

# Clone Dashboards into ../OpenSearch-Dashboards, move the plugin under plugins/, and bootstrap (several minutes)
./scripts/setup-osd.sh 3.9.0

# Start OpenSearch on localhost:9200 with security disabled (skip if one is already running)
docker compose up -d

# Start Dashboards in dev mode (the first optimizer run takes 5–10 minutes)
cd ../OpenSearch-Dashboards
yarn start --no-base-path
```

Open http://localhost:5601/app/dev_tools#/notebook.

### Type checking / linting

Use the Dashboards toolchain; the plugin has no `node_modules` of its own.

```bash
cd ../OpenSearch-Dashboards
OSD_ROOT=$PWD node scripts/eslint plugins/opensearch-notebook/{public,server,common}
```

`eslint.config.js` resolves the shared config from `OSD_ROOT` (defaults to `../..`).

## Build (distributable zip)

```bash
# run inside plugins/opensearch-notebook
yarn build --opensearch-dashboards-version 3.9.0
# → build/opensearchNotebook-3.9.0.zip
```

Install on the target Dashboards:

```bash
./bin/opensearch-dashboards-plugin install file:///path/to/opensearchNotebook-3.9.0.zip
```

## Notes and limitations

- `opensearchDashboardsVersion` in `opensearch_dashboards.json` is `"opensearchDashboards"`, a special value meaning "same version as the host". The real version is embedded when building the zip via `--opensearch-dashboards-version`; the target Dashboards must match down to the patch level or the plugin will not load.
- **Amazon OpenSearch Service's bundled Dashboards does not accept custom plugins.** To use this with a managed domain, run your own Dashboards (EC2 / ECS / …) with the plugin installed and point it at the domain endpoint.
- Multiple data sources (MDS) are not supported; requests always go to the Dashboards default connection.
- Out of scope: passing values between cells, Console autocomplete, table view for `aggregations`.
- `.osnb.json` is not compatible with the upstream Observability Notebooks format (`%sql` / `%ppl` / `%md`).

## Comparison with Observability Notebooks

| | Observability Notebooks (dashboards-observability) | This plugin |
|---|---|---|
| Location | Left nav › Observability › Notebooks | Dev Tools › Notebook tab |
| Cell types | `%sql` / `%ppl` / `%md` / Visualization | DSL (any REST request) / Markdown |
| Execution path | query-workbench `/api/sql/*` → SQL plugin | Own route → `transport.request` |
| Storage | Saved object `observability-notebook` | Saved object `opensearch-notebook` |
| File import/export | None (Saved Objects management only) | `.osnb.json` export / import |

## References

- [Conventions for Plugins](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/CONVENTIONS.md)
- [Dev Tools plugin (`devTools.register`)](https://github.com/opensearch-project/OpenSearch-Dashboards/tree/main/src/plugins/dev_tools)
- [Core Public API](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/public/public.api.md) / [Core Server API](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/server/server.api.md)

## License

Apache License 2.0. See [LICENSE](LICENSE).
