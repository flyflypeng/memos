# Chris Curry's Memos

[English](README.md) | [繁體中文](README_zh-Hant.md) | [日本語](README_ja.md)

![Chris Curry's Memos](https://webp.chriscurry.cc/864shots_so.png)

一个轻量级、可自托管的备忘录中心，用于记录和整理你的想法。

本项目是 [usememos/memos](https://github.com/usememos/memos) 的定制分支，从 [v0.23.0](https://github.com/usememos/memos/releases/tag/v0.23.0) 版本 fork 而来。

## 在线体验

无需安装，直接试用：**[memo-demo.chriscurry.cc](https://memo-demo.chriscurry.cc)**

| 用户名 | 密码 |
|--------|------|
| `chriscurry` | `memos` |

> 公共演示实例——请勿存储敏感信息，数据可能会定期重置。

## 版本差异

查看 [CHANGELOG_zh.md](CHANGELOG_zh.md) 了解与原版 Memos 的详细功能和改进。

**亮点功能：**
- 符合 GFM 规范的 Markdown 渲染：表格中的转义竖线、行内代码、空单元格和列对齐都能正确显示
- CodeMirror 编辑器：语法高亮、格式栏、编辑/预览切换、表格辅助和斜杠命令
- 粘贴或拖放的图片直接嵌入光标所在位置，而不是作为附件追加在末尾
- 可安装为桌面应用（PWA），例如通过 Chrome、Edge 或 Safari 添加到 macOS 程序坞
- 标签管理：支持置顶和 emoji 图标
- 将备忘录导出为精美图片
- 置顶备忘录独立列/抽屉显示
- 代码块折叠/展开
- 改进的日历热力图
- URL 筛选参数持久化
- 更多...

## 功能特点

- **隐私优先** - 自托管部署，数据完全由你掌控
- **Markdown 支持** - 在浏览器中按 GFM 规范渲染：表格、任务列表、带语法高亮的代码块、数学公式（KaTeX）、Mermaid 图表，以及经过消毒的内联 HTML（`<details>`、`<kbd>`、`<br>` 等）
- **增强编辑器** - 基于 CodeMirror 6 的源码编辑器，提供 Markdown 语法高亮、格式栏、编辑/预览切换、表格辅助（插入、Tab/Enter 跳转、格式化、自动转义 `|`）和 `/` 斜杠命令；保存的 Markdown 与输入完全一致
- **内嵌图片** - 粘贴或拖放图片即可上传并插入到光标处；内嵌图片与所在备忘录的可见性一致、随备忘录一起删除，且不会在附件列表中重复显示
- **桌面应用（PWA）** - 从浏览器安装 Memos，获得独立窗口和程序坞图标；应用外壳经过缓存，启动更快；部署新版本后应用内会提示刷新（需要 HTTPS）
- **标签整理** - 通过标签组织备忘录，支持置顶重要标签、添加 emoji 图标
- **时间线视图** - 按时间顺序浏览备忘录，配合活动热力图
- **多平台访问** - 通过浏览器在任何设备上访问，响应式移动端设计
- **轻量高效** - 默认使用 SQLite，资源占用极低
- **RESTful API** - 完整的 API 支持，便于集成和自动化
- **SSO 支持** - OAuth2 身份提供商集成
- **多语言** - i18n 国际化支持

## 快速开始

### Docker Compose（推荐）

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

然后在浏览器中访问 `http://localhost:5230`。

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

### 从源码构建

查看[开发指南](docs/development.md)了解详细步骤。

## 配置

Memos 可以通过环境变量进行配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MEMOS_PORT` | 服务端口 | `5230` |
| `MEMOS_MODE` | 运行模式（`prod`、`dev`、`demo`） | `prod` |
| `MEMOS_DRIVER` | 数据库驱动（`sqlite`、`mysql`、`postgres`） | `sqlite` |
| `MEMOS_DSN` | 数据库连接字符串 | `~/.memos/memos_prod.db` |

使用 MySQL 的示例：

```bash
docker run -d \
  --name memos \
  --restart unless-stopped \
  --publish 5230:5230 \
  -e MEMOS_DRIVER=mysql \
  -e MEMOS_DSN="user:password@tcp(host:3306)/memos" \
  chriscurrycc/memos:latest
```

## 编写备忘录

- **格式栏** - 编辑器获得焦点时显示在上方（禅模式下一直显示）。点击 **编辑 / 预览** 查看效果，预览与时间线使用同一套渲染器。
- **斜杠命令** - 在行首或空格后输入 `/`，可插入标题、列表、引用、代码块、表格、公式块、Mermaid 图表、分割线、嵌入备忘录或上传图片。
- **表格** - 从格式栏插入表格，用 `Tab` / `Shift+Tab` 在单元格间移动，在最后一行按 `Enter` 新增一行，按 `Cmd/Ctrl+Shift+F` 对齐各列。在单元格中输入的 `|` 会自动转义为 `\|`。
- **图片** - 在编辑器中粘贴截图或拖入图片，会以 `![](/file/resources/{id}/{filename})` 的形式嵌入光标处。从正文中删除图片并保存后，文件随之删除。通过附件按钮添加的文件以及非图片文件，仍作为附件显示在备忘录下方。
- **快捷键** - `Cmd/Ctrl+B` / `I` / `K` 分别为粗体、斜体、链接；`Cmd/Ctrl+Enter` 保存；`Cmd/Ctrl+Shift+Enter` 进入禅模式；输入 `#` 补全标签，输入 `@` 嵌入其他备忘录。

## 桌面应用（PWA）

Memos 可以安装为独立应用，拥有自己的窗口和程序坞 / 任务栏图标。实例必须通过 **HTTPS**（或 `localhost`）访问。

- **Chrome / Edge** - 打开 Memos 地址，点击地址栏中的安装图标（或菜单 →「安装 Memos」）。
- **Safari（macOS Sonoma 及以上）** - 菜单「文件 → 添加到程序坞」。

应用外壳会被缓存以加快启动；API 请求和上传的文件始终从服务器获取。部署新版本后，应用会提示「有新版本可用」，不会自行重新加载。

> 备忘录正文改为在浏览器中根据 `memo.content` 渲染。`nodes` 字段以及 `ParseMarkdown` / `RestoreMarkdownNodes` / `StringifyMarkdownNodes` 三个 RPC 已移除，依赖它们的第三方客户端需要自行渲染 `content`。

## 更新

### Docker 镜像标签

| 标签 | 说明 | 适用人群 |
|------|------|----------|
| `latest` | 每次发布都会更新（包括 beta） | 喜欢尝鲜、想第一时间体验新功能的用户 |
| `stable` | 仅在稳定版发布时更新 | 追求稳定、不想踩坑的用户 |
| `vX.Y.Z` | 固定到某个具体版本 | 需要完全控制版本的用户 |

### 使用 Watchtower 自动更新（推荐）

使用 [Watchtower](https://containrrr.dev/watchtower/) 实现自动更新，根据你的偏好选择镜像标签：

```yaml
# docker-compose.yml
services:
  memos:
    image: chriscurrycc/memos:latest  # 或 :stable 仅接收稳定版更新
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
    command: --schedule "0 0 3 * * *" memos  # 每天凌晨 3:00 检查更新
```

或执行单次更新：

```bash
docker run --rm \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --run-once \
  memos
```

### 手动更新

```bash
docker pull chriscurrycc/memos:latest  # 或 :stable
docker stop memos && docker rm memos
docker run -d \
  --init \
  --name memos \
  --restart unless-stopped \
  --publish 5230:5230 \
  --volume ~/.memos/:/var/opt/memos \
  chriscurrycc/memos:latest
```

## 从 usememos/memos 迁移

如果你是从原版 [usememos/memos](https://github.com/usememos/memos) 项目迁移：

**兼容性说明：**
- 从 v0.23.0 ~ v0.23.1 迁移：完全兼容
- 从 v0.24.0 ~ v0.26.2 迁移：运行下方的迁移修复脚本后兼容

关于数据库层面的具体差异和修复脚本的工作原理，请参阅[迁移指南](docs/migration-guide_zh.md)。

> **警告：迁移前必须备份数据，此步骤不可跳过。**
>
> 如果迁移失败或产生意外结果，备份是恢复数据的唯一途径。请先停止服务，然后复制数据目录（默认：`~/.memos/`）。MySQL/PostgreSQL 用户的数据库在外部服务器上，还需额外执行 `mysqldump`/`pg_dump` 来备份数据库。详细备份步骤请参阅[迁移指南](docs/migration-guide_zh.md)。

**迁移修复：**

从上游 v0.24.0 ~ v0.26.2 迁移时，**在启动本 fork 服务之前**运行[迁移修复脚本](scripts/migration-repair.sh)来修复数据库结构差异并创建缺失的表。脚本需要对应数据库的命令行工具（`sqlite3`、`mysql` 或 `psql`）：

```bash
# SQLite（默认路径：~/.memos/memos_prod.db）
curl -sL https://raw.githubusercontent.com/chriscurrycc/memos/main/scripts/migration-repair.sh | bash -s -- --driver sqlite --dsn ~/.memos/memos_prod.db

# MySQL
curl -sL https://raw.githubusercontent.com/chriscurrycc/memos/main/scripts/migration-repair.sh | bash -s -- --driver mysql --dsn "user:password@tcp(host:3306)/memos"

# PostgreSQL
curl -sL https://raw.githubusercontent.com/chriscurrycc/memos/main/scripts/migration-repair.sh | bash -s -- --driver postgres --dsn "postgresql://user:password@host:5432/memos"
```

该脚本是幂等的，可以安全地多次运行。

## 版本说明

本项目使用两个独立的版本号：

- **应用版本**（如 `v0.30.0`）— 发布版本，每次新增功能或改进时递增。对应 Docker 标签和 GitHub Releases。
- **数据库版本**（如 `0.25.2`）— 数据库迁移版本，仅在数据库结构变更时递增。定义在 [`store/migration/SCHEMA_VERSION`](store/migration/SCHEMA_VERSION)。

应用版本可能在数据库版本不变的情况下多次递增。例如，多个功能发布可能共享同一个数据库版本（如仅涉及前端或 API 变更）。

> **说明：** 日常使用无需关注数据库版本，仅在从原版 usememos/memos 迁移时需要了解。原版的数据库版本与应用版本绑定——即使数据库没有任何变化，数据库版本号也会随每次 minor 版本发布而递增（如 v0.26 → v0.27）。因此下文兼容性范围中提到的「v0.24.0 ~ v0.26.2」指的是原版的**应用版本**，并非实际的数据库变更版本。

## 生态系统

### MCP 服务器

使用 [MCP 服务器](https://github.com/chriscurrycc/memos-mcp) 将 AI 助手（Claude Code、Claude Desktop、Cursor 等）连接到你的 Memos 实例：

```bash
npx @chriscurrycc/memos-mcp
```

17 个工具，支持 Memo 增删改查与搜索、标签、资源、关联和回顾 — 以及 6 个工作流提示词（活动总结、间隔回顾、关系图谱等）。详细配置请参阅 [memos-mcp](https://github.com/chriscurrycc/memos-mcp) 仓库。

### Pixmo

[Pixmo](https://pixmo.cc) 是一个可以连接 Memos 服务器的照片墙 — 将你的备忘录转化为可浏览的图片画廊，支持瀑布流布局、时间线导航、EXIF 信息展示和标签云。

- 演示：[ccmemos.pixmo.cc](https://ccmemos.pixmo.cc)（连接本 fork）
- 同时支持本 fork 和原版 Memos v0.26.x+

## 文档

- [开发指南](docs/development.md) - 搭建本地开发环境
- [Windows 开发指南](docs/development-windows.md) - Windows 特定设置
- [API 文档](docs/API.md) - REST API 参考
- [我是如何开发这个项目的](https://github.com/chriscurrycc/memos/issues/8) - 开发博客
