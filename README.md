# opensearch_notebook

OpenSearch Dashboards プラグイン。公式の `node scripts/generate_plugin.js` が生成する雛形（server + ui あり）と同じ構成。

## 構成

```
opensearch_dashboards.json   # マニフェスト（id: opensearchNotebook）
common/                      # public / server 共通の定数・型
public/                      # ブラウザ側（React + EUI）
  plugin.ts                  #   core.application.register() で左ナビにアプリ登録
  application.tsx            #   React マウント
  components/app.tsx         #   サンプル画面（サーバー API を呼ぶボタン）
server/                      # Dashboards サーバー側（Node.js）
  plugin.ts                  #   setup/start ライフサイクル
  routes/index.ts            #   GET /api/opensearch_notebook/example
translations/ja-JP.json      # i18n
scripts/setup-osd.sh         # 開発環境セットアップ
docker-compose.yml           # 開発用 OpenSearch（セキュリティ無効）
```

## 開発環境のセットアップ

プラグインは OpenSearch Dashboards 本体の `plugins/` 配下に置いた状態でビルド・実行する。
このリポジトリは本体リポジトリの隣に置き、`plugins/` からシンボリックリンクする。

```bash
# Node は本体の .nvmrc に合わせる（3.9.0 は Node 22）
nvm install 22 && nvm use 22

# 本体を ../OpenSearch-Dashboards に clone し、plugins/ にリンク、bootstrap まで実行
./scripts/setup-osd.sh 3.9.0

# 接続先 OpenSearch を起動（localhost:9200、セキュリティ無効）
docker compose up -d

# Dashboards を開発モードで起動（ホットリロードあり）
cd ../OpenSearch-Dashboards
yarn start --no-base-path
```

http://localhost:5601 を開き、左ナビの `opensearch_notebook` から画面を確認する。

本体側の `config/opensearch_dashboards.yml` はデフォルト（`opensearch.hosts: ["http://localhost:9200"]`）のままで接続できる。
セキュリティプラグイン有効の OpenSearch に接続する場合は `opensearch.username` / `opensearch.password` / `opensearch.ssl.verificationMode: none` を追加する。

## ビルド（配布用 zip）

```bash
# plugins/opensearch-notebook（リンク先）で実行
yarn build --opensearch-dashboards-version 3.9.0
# → build/opensearchNotebook-3.9.0.zip
```

配布先の Dashboards でインストール:

```bash
./bin/opensearch-dashboards-plugin install file:///path/to/opensearchNotebook-3.9.0.zip
```

## 注意点

- `opensearch_dashboards.json` の `opensearchDashboardsVersion` は `"opensearchDashboards"`（= 本体と同じバージョンを意味する特殊値）にしてある。開発中はこのままでよく、配布 zip 作成時は `--opensearch-dashboards-version` で実バージョンが埋め込まれる。配布先の Dashboards とパッチレベルまで一致しないとロードされない。
- `import ... from '../../../src/core/public'` のような相対パスは「本体の `plugins/<name>/` に置かれる」前提。別の場所に置くと解決できない。
- Amazon OpenSearch Service 付属の Dashboards にはカスタム Dashboards プラグインを入れられない。マネージドドメインを使う場合は、自前の Dashboards サーバー（EC2 / ECS 等）にこのプラグインを入れ、ドメインエンドポイントに接続する。

## 参考

- [Conventions for Plugins](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/CONVENTIONS.md)
- [Core Public API](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/public/public.api.md) / [Core Server API](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/server/server.api.md)
- [Testing OpenSearch Dashboards Plugins](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/src/core/TESTING.md)
- [CONTRIBUTING.md](https://github.com/opensearch-project/OpenSearch-Dashboards/blob/main/CONTRIBUTING.md)
