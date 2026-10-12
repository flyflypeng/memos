# 16：构建镜像、推送 ghcr、NAS 上线与人工验收

**要做什么：** 把全部改动交付到 NAS 上的线上服务：
1. 更新 CHANGELOG，把功能分支一次性推送到 `origin`。
2. 在构建机 shanghai-ali-ecs-64c 上拉取并构建镜像，冒烟测试后推送到私有仓库 `ghcr.io/flyflypeng/memos`。
3. 经用户确认后，NAS 从 ghcr.io 拉取镜像并切换线上容器。
4. 最后通过现有 HTTPS 域名完成人工验收。

**被阻塞于：** 05、08、11、12、15

**Status:** resolved

- [x] CHANGELOG.md 与 CHANGELOG_zh.md 已更新；分支使用 `feat/` 前缀（不用 `claude/`、`chriscurry/`），推送到 `origin`，不打 tag
- [x] 构建机上 `docker build` 成功，标签为 `ghcr.io/flyflypeng/memos:<短提交哈希>`；用临时端口和临时数据目录完成冒烟测试（healthz、manifest、sw.js no-cache、创建 Memo 时不返回 nodes、标签和 hasImage 正确、restore RPC 返回 404）
- [x] 推送到 ghcr.io（私有）；token 经标准输入传入，使用临时 DOCKER_CONFIG，推送后删除，不进入命令参数和日志
- [x] 切换前备份 Compose 文件和 `memos_prod.db`；NAS 用只读的 `read:packages` 凭据登录 ghcr.io；用户明确确认后，才把线上服务改为新镜像并重建容器；数据库无需迁移
- [x] 通过 HTTPS 验收：Chrome 安装 PWA、独立窗口、标题栏跟随主题、再次部署后出现刷新提示、API 和文件响应不来自 service worker 缓存
- [x] Safari「添加到程序坞」的名称和图标正确；中文输入法在 macOS Chrome 和 Safari 中可用；手机上能输入并保存 Memo
- [x] 在线上数据中抽查：旧 Memo 的表格、标签、嵌入、内嵌图片显示正确
- [x] NAS 地址、端口、用户名和凭据都没有写进仓库

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。

## Comments

- 2026-10-12：镜像 `ghcr.io/flyflypeng/memos:06c5c50`（也打了 `feat-markdown-editor` 标签），digest `sha256:42be3f3676175ea743fdc5b3b148ce9ac4a118bea6e95e0a6dd85701ee584bdd`，在构建机 shanghai-ali-ecs-64c 上构建，冒烟测试通过，已推送为私有包。
- 2026-10-12：已切换 NAS 线上服务（用户授权主代理执行，docker 已加入 sudo 免密白名单）。原容器不是由 Compose 创建的（没有 compose 标签），所以按 `docker inspect` 的结果用 `docker run` 原样重建：端口、数据卷、restart、CPU 和内存限制、tty、cap-drop、日志配置都相同，并重新加入 `personal-workflow_hermes` 网络，别名仍为 `chriscurrycc_memos`。
  - 停服后备份到数据目录下的 `backup-20261012-111111/`，包含 db 和原 compose 文件；正常停止时 WAL 已合并进 db，所以 db 文件本身是一致的。
  - 旧容器重命名为 `chriscurrycc_memos_old_20261012-111111`，保持停止状态，restart 改为 no。
  - 回滚：`docker stop chriscurrycc_memos && docker rm chriscurrycc_memos && docker rename chriscurrycc_memos_old_20261012-111111 chriscurrycc_memos && docker update --restart=always chriscurrycc_memos && docker start chriscurrycc_memos`，然后重新执行 `docker network connect --alias chriscurrycc_memos personal-workflow_hermes chriscurrycc_memos`。
  - 验证：在 NAS 本机上，healthz 返回 200，manifest 已注入，sw.js 返回 no-cache；经 Caddy 的 8443 端口（ZeroSSL 通配符证书）访问 mem/note 两个域名都返回 200；hermes adapter 在网络内访问 `chriscurrycc_memos:5230/healthz` 正常。
  - ghcr 登录使用临时 `--config` 目录，拉取后已登出并删除该目录。
  - 外网 HTTPS 验收尚未完成：从开发机所在网络访问 `*.u280167.nyat.app:8443` 时，TLS 握手被对端以 unrecognized_name 拒绝。这条链路是 Natfrp 到 Caddy，与本次切换无关，需要用户在自己的网络环境中用浏览器验收。
- 2026-10-12：用户在浏览器中完成人工验收，确认预期功能均正常。工单关闭。
