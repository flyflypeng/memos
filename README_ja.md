# Chris Curry's Memos

[English](README.md) | [简体中文](README_zh.md) | [繁體中文](README_zh-Hant.md)

![Chris Curry's Memos](https://webp.chriscurry.cc/864shots_so.png)

軽量でセルフホスト可能なメモハブ。あなたの考えを記録・整理するためのツールです。

このプロジェクトは [usememos/memos](https://github.com/usememos/memos) のカスタマイズ版フォークで、[v0.23.0](https://github.com/usememos/memos/releases/tag/v0.23.0) からフォークされています。

## デモ

インストール不要でそのまま試せます：**[memo-demo.chriscurry.cc](https://memo-demo.chriscurry.cc)**

| ユーザー名 | パスワード |
|------------|------------|
| `chriscurry` | `memos` |

> 共有デモインスタンスです。機密情報は保存しないでください。データは定期的にリセットされる場合があります。

## 変更点

オリジナル Memos との詳細な機能と改善点は [CHANGELOG.md](CHANGELOG.md) をご覧ください。

**主な機能：**
- GFM 準拠の Markdown レンダリング：エスケープしたパイプ、インラインコード、空セル、列揃えを含む表を正しく表示
- CodeMirror エディター：シンタックスハイライト、書式バー、編集/プレビュー切り替え、表の入力補助、スラッシュコマンド
- 貼り付け・ドロップした画像を末尾の添付ファイルではなくカーソル位置に埋め込み
- デスクトップアプリ（PWA）としてインストール可能。Chrome・Edge・Safari から macOS の Dock に追加できます
- タグ管理：ピン留めと絵文字アイコンのサポート
- メモを美しい画像としてエクスポート
- ピン留めメモを別カラム/ドロワーに表示
- コードブロックの折りたたみ/展開
- 改善されたカレンダーヒートマップ
- URL フィルターパラメータの永続化
- その他多数...

## 特徴

- **プライバシー重視** - セルフホストで、データは完全にあなたの管理下に
- **Markdown 対応** - ブラウザで GFM 準拠のレンダリング：表、タスクリスト、シンタックスハイライト付きコードブロック、数式（KaTeX）、Mermaid 図、サニタイズ済みインライン HTML（`<details>`・`<kbd>`・`<br>` など）
- **高機能エディター** - CodeMirror 6 ベースのソースエディター。Markdown のシンタックスハイライト、書式バー、編集/プレビュー切り替え、表の入力補助（挿入、Tab/Enter での移動、整形、`|` の自動エスケープ）、`/` スラッシュコマンドを備え、入力した Markdown をそのまま保存
- **インライン画像** - 画像を貼り付け・ドロップするとアップロードしてカーソル位置に挿入。インライン画像はメモと同じ公開範囲になり、メモと一緒に削除され、添付ファイル一覧には重複表示されません
- **デスクトップアプリ（PWA）** - ブラウザから Memos をインストールすると、専用ウィンドウと Dock アイコンを利用可能。アプリシェルのキャッシュで素早く起動し、新バージョンのデプロイ時にはアプリ内で更新を案内します（HTTPS が必要）
- **タグ整理** - タグでメモを整理、重要なタグをピン留め、絵文字アイコンを追加
- **タイムライン表示** - アクティビティヒートマップ付きで時系列にメモを閲覧
- **マルチプラットフォーム** - ブラウザからどのデバイスでもアクセス可能、モバイル対応レスポンシブデザイン
- **軽量** - SQLite をデフォルトで使用し、リソース消費を最小限に
- **RESTful API** - 統合と自動化のための完全な API サポート
- **SSO サポート** - OAuth2 ID プロバイダー統合
- **多言語対応** - i18n 国際化サポート

## クイックスタート

### Docker Compose（推奨）

```yaml
services:
  memos:
    image: chriscurrycc/memos:latest
    container_name: memos
    restart: unless-stopped
    ports:
      - 5230:5230
    volumes:
      - ~/.memos/:/var/opt/memos
```

```bash
docker compose up -d
```

ブラウザで `http://localhost:5230` にアクセスしてください。

### Docker

```bash
docker run -d \
  --init \
  --name memos \
  --restart unless-stopped \
  --publish 5230:5230 \
  --volume ~/.memos/:/var/opt/memos \
  chriscurrycc/memos:latest
```

### ソースからビルド

詳細な手順は[開発ガイド](docs/development.md)をご覧ください。

## 設定

Memos は環境変数で設定できます：

| 変数 | 説明 | デフォルト |
|------|------|------------|
| `MEMOS_PORT` | サーバーポート | `5230` |
| `MEMOS_MODE` | 実行モード（`prod`、`dev`、`demo`） | `prod` |
| `MEMOS_DRIVER` | データベースドライバー（`sqlite`、`mysql`、`postgres`） | `sqlite` |
| `MEMOS_DSN` | データベース接続文字列 | `~/.memos/memos_prod.db` |

MySQL を使用する例：

```bash
docker run -d \
  --name memos \
  --restart unless-stopped \
  --publish 5230:5230 \
  -e MEMOS_DRIVER=mysql \
  -e MEMOS_DSN="user:password@tcp(host:3306)/memos" \
  chriscurrycc/memos:latest
```

## メモの書き方

- **書式バー** - エディターにフォーカスがあるときに上部に表示されます（禅モードでは常に表示）。**編集 / プレビュー** で結果を確認でき、プレビューはタイムラインと同じレンダラーを使います。
- **スラッシュコマンド** - 行頭またはスペースの後に `/` を入力すると、見出し、リスト、引用、コードブロック、表、数式ブロック、Mermaid 図、区切り線、メモの埋め込み、画像のアップロードを挿入できます。
- **表** - 書式バーから表を挿入し、`Tab` / `Shift+Tab` でセル間を移動、最終行で `Enter` を押すと行を追加、`Cmd/Ctrl+Shift+F` で列を揃えます。セル内で入力した `|` は自動的に `\|` にエスケープされます。
- **画像** - スクリーンショットを貼り付けるか画像をドロップすると、`![](/file/resources/{id}/{filename})` としてカーソル位置に埋め込まれます。本文から画像を削除して保存するとファイルも削除されます。添付ボタンで追加したファイルや画像以外のファイルは、これまで通りメモ下部の添付ファイルになります。
- **ショートカット** - `Cmd/Ctrl+B` / `I` / `K` で太字・斜体・リンク、`Cmd/Ctrl+Enter` で保存、`Cmd/Ctrl+Shift+Enter` で禅モード、`#` でタグ補完、`@` で他のメモを埋め込み。

## デスクトップアプリ（PWA）

Memos は専用ウィンドウと Dock / タスクバーアイコンを持つアプリとしてインストールできます。インスタンスは **HTTPS**（または `localhost`）で配信されている必要があります。

- **Chrome / Edge** - Memos の URL を開き、アドレスバーのインストールアイコン（またはメニュー →「Memos をインストール」）をクリック。
- **Safari（macOS Sonoma 以降）** - メニュー「ファイル → Dock に追加」。

アプリシェルはキャッシュされるため素早く起動します。API リクエストとアップロードしたファイルは常にサーバーから取得されます。新しいバージョンをデプロイすると、自動で再読み込みせずに「新しいバージョンがあります」と案内します。

> メモ本文はブラウザで `memo.content` からレンダリングするようになりました。`nodes` フィールドと `ParseMarkdown` / `RestoreMarkdownNodes` / `StringifyMarkdownNodes` RPC は削除されたため、これらに依存するサードパーティクライアントは `content` を自前でレンダリングする必要があります。

## 更新

### Docker イメージタグ

| タグ | 説明 | 対象ユーザー |
|------|------|--------------|
| `latest` | すべてのリリースで更新（betaを含む） | 最新機能をいち早く試したいユーザー |
| `stable` | 安定版リリースのみ更新 | 安定性を重視するユーザー |
| `vX.Y.Z` | 特定バージョンに固定 | バージョンを完全にコントロールしたいユーザー |

### Watchtower で自動更新（推奨）

[Watchtower](https://containrrr.dev/watchtower/) を使って自動更新を設定します。お好みに応じてイメージタグを選択してください：

```yaml
# docker-compose.yml
services:
  memos:
    image: chriscurrycc/memos:latest  # または :stable で安定版のみ更新
    container_name: memos
    restart: unless-stopped
    ports:
      - 5230:5230
    volumes:
      - ~/.memos/:/var/opt/memos

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - TZ=Asia/Shanghai
    command: --schedule "0 0 3 * * *" memos  # 毎日午前3時に更新確認
```

または単発更新：

```bash
docker run --rm \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --run-once \
  memos
```

### 手動更新

```bash
docker pull chriscurrycc/memos:latest  # または :stable
docker stop memos && docker rm memos
docker run -d \
  --init \
  --name memos \
  --restart unless-stopped \
  --publish 5230:5230 \
  --volume ~/.memos/:/var/opt/memos \
  chriscurrycc/memos:latest
```

## usememos/memos からの移行

オリジナルの [usememos/memos](https://github.com/usememos/memos) プロジェクトから移行する場合：

**互換性について：**
- v0.23.0 ~ v0.23.1 からの移行：完全互換
- v0.24.0 ~ v0.26.2 からの移行：下記の移行修復スクリプトを実行後に互換

データベースレベルの具体的な違いと修復スクリプトの動作内容については、[移行ガイド](docs/migration-guide_ja.md)を参照してください。

> **警告：移行前に必ずデータをバックアップしてください。この手順は省略できません。**
>
> 移行が失敗した場合や予期しない結果が生じた場合、バックアップがデータを復旧する唯一の方法です。まずサービスを停止し、データディレクトリをコピーしてください（デフォルト：`~/.memos/`）。MySQL/PostgreSQL ユーザーはデータベースが外部サーバー上にあるため、別途 `mysqldump`/`pg_dump` でデータベースのバックアップも必要です。詳しいバックアップ手順は[移行ガイド](docs/migration-guide_ja.md)を参照してください。

**移行修復：**

上流 v0.24.0 ~ v0.26.2 から移行する場合、**本 fork のサービスを起動する前に**[移行修復スクリプト](scripts/migration-repair.sh)を実行してデータベーススキーマの差異を修正し、不足テーブルを作成してください。スクリプトにはデータベースに応じた CLI ツール（`sqlite3`、`mysql`、または `psql`）が必要です：

```bash
# SQLite（デフォルトパス：~/.memos/memos_prod.db）
curl -sL https://raw.githubusercontent.com/chriscurrycc/memos/main/scripts/migration-repair.sh | bash -s -- --driver sqlite --dsn ~/.memos/memos_prod.db

# MySQL
curl -sL https://raw.githubusercontent.com/chriscurrycc/memos/main/scripts/migration-repair.sh | bash -s -- --driver mysql --dsn "user:password@tcp(host:3306)/memos"

# PostgreSQL
curl -sL https://raw.githubusercontent.com/chriscurrycc/memos/main/scripts/migration-repair.sh | bash -s -- --driver postgres --dsn "postgresql://user:password@host:5432/memos"
```

このスクリプトは冪等性があり、複数回安全に実行できます。

## バージョニング

本プロジェクトでは2つの独立したバージョン番号を使用しています：

- **アプリケーションバージョン**（例：`v0.30.0`）— リリースバージョン。新機能や改善が追加されるたびにインクリメントされます。Docker タグや GitHub Releases に対応します。
- **データベーススキーマバージョン**（例：`0.25.2`）— データベースマイグレーションバージョン。データベース構造が変更された場合のみインクリメントされます。[`store/migration/SCHEMA_VERSION`](store/migration/SCHEMA_VERSION) で定義されています。

アプリケーションバージョンはデータベーススキーマの変更なしに複数回インクリメントされることがあります。例えば、フロントエンドや API の変更のみを含む複数の機能リリースが同じスキーマバージョンを共有することがあります。

> **補足：** 日常の使用ではデータベースバージョンを気にする必要はありません。オリジナルの usememos/memos から移行する場合にのみ関係します。オリジナルではデータベースバージョンがアプリケーションバージョンに連動しており、データベースに変更がなくても minor リリースごとにバージョン番号が上がります（例：v0.26 → v0.27）。そのため、下記の互換性範囲「v0.24.0 ~ v0.26.2」はオリジナルの**アプリケーションバージョン**を指しており、実際のデータベース変更バージョンではありません。

## エコシステム

### MCP サーバー

[MCP サーバー](https://github.com/chriscurrycc/memos-mcp) を使用して、AI アシスタント（Claude Code、Claude Desktop、Cursor など）を Memos インスタンスに接続できます：

```bash
npx @chriscurrycc/memos-mcp
```

17 のツールでメモの CRUD・検索、タグ、リソース、リレーション、レビューに対応。さらに 6 つのワークフロープロンプト（ダイジェスト、レビュー、リレーショングラフなど）を搭載。設定方法は [memos-mcp](https://github.com/chriscurrycc/memos-mcp) リポジトリをご覧ください。

### Pixmo

[Pixmo](https://pixmo.cc) は Memos サーバーに接続できるフォトウォール — メモを閲覧可能な画像ギャラリーに変換します。マソンリーレイアウト、タイムラインナビゲーション、EXIF 情報表示、タグクラウドに対応。

- デモ：[ccmemos.pixmo.cc](https://ccmemos.pixmo.cc)（本 fork に接続）
- 本 fork とオリジナル Memos v0.26.x+ の両方に対応

## ドキュメント

- [開発ガイド](docs/development.md) - ローカル開発環境のセットアップ
- [Windows 開発ガイド](docs/development-windows.md) - Windows 固有の設定
- [API ドキュメント](docs/API.md) - REST API リファレンス
- [このプロジェクトの開発について](https://github.com/chriscurrycc/memos/issues/8) - 開発ブログ
