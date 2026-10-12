# 16：构建镜像、推送 ghcr、NAS 上线与人工验收

**要做什么：** 把全部改动交付到 NAS 上的线上服务：
1. 更新 CHANGELOG，把功能分支一次性推送到 `origin`。
2. 在构建机 shanghai-ali-ecs-64c 上拉取并构建镜像，冒烟测试后推送到私有仓库 `ghcr.io/flyflypeng/memos`。
3. 经用户确认后，NAS 从 ghcr.io 拉取镜像并切换线上容器。
4. 最后通过现有 HTTPS 域名完成人工验收。

**被阻塞于：** 05、08、11、12、15

**Status:** ready-for-agent

- [x] CHANGELOG.md 与 CHANGELOG_zh.md 已更新；分支使用 `feat/` 前缀（不用 `claude/`、`chriscurry/`），推送到 `origin`，不打 tag
- [x] 构建机上 `docker build` 成功，标签为 `ghcr.io/flyflypeng/memos:<短提交哈希>`；用临时端口和临时数据目录完成冒烟测试（healthz、manifest、sw.js no-cache、创建 Memo 时不返回 nodes、标签和 hasImage 正确、restore RPC 返回 404）
- [x] 推送到 ghcr.io（私有）；token 经标准输入传入，使用临时 DOCKER_CONFIG，推送后删除，不进入命令参数和日志
- [ ] 切换前备份 Compose 文件和 `memos_prod.db`；NAS 用只读的 `read:packages` 凭据登录 ghcr.io；用户明确确认后，才把线上服务改为新镜像并重建容器；数据库无需迁移
- [ ] 通过 HTTPS 验收：Chrome 安装 PWA、独立窗口、标题栏跟随主题、再次部署后出现刷新提示、API 和文件响应不来自 service worker 缓存
- [ ] Safari「添加到程序坞」的名称和图标正确；中文输入法在 macOS Chrome 和 Safari 中可用；手机上能输入并保存 Memo
- [ ] 在线上数据中抽查：旧 Memo 的表格、标签、嵌入、内嵌图片显示正确
- [x] NAS 地址、端口、用户名和凭据都没有写进仓库

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。

## Comments

- 2026-10-12：镜像 `ghcr.io/flyflypeng/memos:06c5c50`（也打了 `feat-markdown-editor` 标签），digest `sha256:42be3f3676175ea743fdc5b3b148ce9ac4a118bea6e95e0a6dd85701ee584bdd`，在构建机 shanghai-ali-ecs-64c 上构建，冒烟测试通过，已推送为私有包。
