# opensearch-notebook

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

OpenSearch Dashboards の **Dev Tools に「Notebook」タブを追加する**プラグイン。
Console / Query Profiler と並ぶタブとして動作し、Jupyter 風のセル形式で DSL（REST リクエスト）を実行・記録できる。

![tabs](https://img.shields.io/badge/Dev%20Tools-Console%20%7C%20Query%20Profiler%20%7C%20Notebook-blue)

## 機能

- **セル**
  - `DSL` セル: HTTP メソッド（プルダウン: GET / POST / PUT / DELETE / HEAD / PATCH）+ パス + JSON ボディ（Monaco エディタ）
  - `Markdown` セル: EUI の Markdown 描画。ダブルクリックで編集、Shift+Enter で表示に戻る
  - セルの追加 / 削除 / 上下移動、Shift+Enter で実行、「Run all」で上から順に実行
  - **Console 形式の貼り付け**: `GET posts/_search` + JSON ボディ をセル（パス欄 or ボディ）に貼ると、メソッド / パス / ボディに自動で振り分け。複数リクエストを一度に貼ると 2 つ目以降は新しいセルになる。`#` / `//` コメント行は無視
  - 「Copy as Console request」でセルの内容を Console 形式でクリップボードへ
  - 編集中の内容は localStorage に自動保存され、タブ切り替え・リロード後も復元される（Console と同じ挙動）
- **出力**
  - ステータスコード・所要時間・実行時刻 + 生 JSON（折りたたみ・コピー可）
  - **テーブル表示**に切替可: `hits.hits` を含む `_search` 結果（`_source` をフラット化）、またはトップレベルがオブジェクト配列のレスポンス（`_cat/*?format=json` 等）
  - 4xx/5xx もエラーとして出力に表示（例外にならない）
- **保存**: Dashboards の Saved Object（type `opensearch-notebook`）として `.kibana` に保存
  - 「Open」で保存済み一覧 → 開く / 削除、「Save as copy」で複製
  - テナント分離・権限・Stack Management › Saved Objects からの export/import が標準で付く
  - ディープリンク: `/app/dev_tools#/notebook?id=<savedObjectId>`
- **ファイル export / import**: 独自 JSON 形式（`<title>.osnb.json`）をブラウザからダウンロード／ファイル選択で読み込み
  - export 時に「出力を含める」を選択可能

## 構成

```
opensearch_dashboards.json   # id: opensearchNotebook, requiredPlugins: devTools, opensearchDashboardsReact
common/
  index.ts                   # 型（Notebook / NotebookCell / CellOutput …）と定数（ルート、SavedObject type、ファイル拡張子）
  notebook_file.ts           # .osnb.json のパース / 生成 / バリデーション
  console_request.ts         # Console 形式テキスト ⇄ {method, path, body} の変換
public/
  plugin.ts                  # devTools.register({ id: 'notebook', ... }) でタブ登録
  application.tsx            # React マウント（OpenSearchDashboardsContextProvider で CodeEditor に uiSettings を供給）
  dsl_language.ts            # ボディエディタ用の JSON Monarch 文法（OSD の Monaco には json トークナイザが無いため）
  storage.ts                 # SavedObjects クライアントのラッパ、ファイル download / read
  components/
    notebook_app.tsx         # ツールバー（New / Open / Save / Export / Import / Run all / Clear outputs）とセル一覧
    cell.tsx                 # DSL セル（メソッド <select>、パス、Monaco）/ Markdown セル
    cell_output.tsx          # ステータスバッジ、JSON、hits テーブル
    saved_notebooks_flyout.tsx
server/
  plugin.ts                  # SavedObject type 登録 + ルート定義
  saved_objects.ts           # type 'opensearch-notebook'（title/description/cells(JSON文字列)/schemaVersion）
  routes/index.ts            # POST /api/opensearch_notebook/execute
translations/ja-JP.json
scripts/setup-osd.sh         # 開発環境セットアップ
docker-compose.yml           # 開発用 OpenSearch（セキュリティ無効）
```

### クエリ実行経路

```
ブラウザ ──POST /api/opensearch_notebook/execute {method,path,body}──▶ Dashboards サーバー
          ◀── 200 {statusCode, body, durationMs} ──────────────────────  │
                                      opensearch.client.asCurrentUser.transport.request(...) ──▶ OpenSearch
```

- 任意のメソッド・パスを転送する（Console と同等）。`?` 以降は querystring として分離
- ログインユーザーの権限で実行される（FGAC 環境ではユーザーの権限がそのまま適用）
- 400/401/403/404/405/409/429 は例外にせずステータスとボディをそのまま返す。5xx/接続失敗も 200 で `{statusCode, body}` にして返し、セル出力として表示する

### ファイル形式（`.osnb.json`）

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

`output` は任意（export 時に外せる）。import 時は `schemaVersion`・`type`・`request.method` などを検証し、不正なら理由付きで拒否する。

## 開発環境のセットアップ

プラグインは Dashboards 本体の `plugins/` 配下に **実ディレクトリとして** 置く必要がある（`plugins/` 内がシンボリックリンクだとサーバー側の `require('@osd/config-schema')` が解決できない）。
`setup-osd.sh` はこのリポジトリを `../OpenSearch-Dashboards/plugins/opensearch-notebook` に移動し、元の場所にシンボリックリンクを残す。

```bash
# Node は本体の .nvmrc に合わせる（3.9.0 は Node 22）
nvm install 22 && nvm use 22

# 本体を ../OpenSearch-Dashboards に clone し、plugins/ に配置、bootstrap まで実行（数分〜十数分）
./scripts/setup-osd.sh 3.9.0

# 接続先 OpenSearch を起動（localhost:9200、セキュリティ無効）。既に動いていれば不要
docker compose up -d

# Dashboards を開発モードで起動（初回の optimizer は 5〜10 分かかる）
cd ../OpenSearch-Dashboards
yarn start --no-base-path
```

http://localhost:5601/app/dev_tools#/notebook を開く。

### 型チェック / lint

本体のツールチェーンを使う（プラグイン単体では node_modules を持たない）。

```bash
cd ../OpenSearch-Dashboards
OSD_ROOT=$PWD node scripts/eslint plugins/opensearch-notebook/{public,server,common}
```

`eslint.config.js` は `OSD_ROOT`（未指定なら `../..`）から共有設定を解決する。

## ビルド（配布用 zip）

```bash
# plugins/opensearch-notebook で実行
yarn build --opensearch-dashboards-version 3.9.0
# → build/opensearchNotebook-3.9.0.zip
```

配布先の Dashboards でインストール:

```bash
./bin/opensearch-dashboards-plugin install file:///path/to/opensearchNotebook-3.9.0.zip
```

## 注意点・制限

- `opensearch_dashboards.json` の `opensearchDashboardsVersion` は `"opensearchDashboards"`（本体と同じバージョンを意味する特殊値）。配布 zip 作成時は `--opensearch-dashboards-version` で実バージョンが埋め込まれる。配布先とパッチレベルまで一致しないとロードされない。
- **Amazon OpenSearch Service 付属の Dashboards にはカスタムプラグインを入れられない**。マネージドドメインで使う場合は、自前の Dashboards（EC2 / ECS 等）にこのプラグインを入れ、ドメインエンドポイントに接続する。
- マルチデータソース（MDS）は未対応。Dashboards のデフォルト接続先に対してのみ実行する。
- セル間の変数受け渡し、Console の autocomplete 連携、`aggregations` のテーブル化はスコープ外。
- `.osnb.json` は本家 Observability Notebooks（`%sql` / `%ppl` / `%md`）とは互換性がない。

## 本家 Notebooks との違い

| | Observability Notebooks（dashboards-observability） | このプラグイン |
|---|---|---|
| 場所 | 左ナビ › Observability › Notebooks | Dev Tools › Notebook タブ |
| セル種別 | `%sql` / `%ppl` / `%md` / Visualization | DSL（任意の REST） / Markdown |
| 実行経路 | query-workbench の `/api/sql/*` → SQL プラグイン | 自前ルート → `transport.request` |
| 保存先 | Saved Object `observability-notebook` | Saved Object `opensearch-notebook` |
| ファイル入出力 | なし（Saved Objects 管理画面のみ） | `.osnb.json` export / import |

## 参考

- [Conventions for Plugins](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/CONVENTIONS.md)
- [Dev Tools plugin（`devTools.register`）](https://github.com/opensearch-project/OpenSearch-Dashboards/tree/main/src/plugins/dev_tools)
- [Core Public API](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/public/public.api.md) / [Core Server API](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/server/server.api.md)

## License

Apache License 2.0. See [LICENSE](LICENSE).
