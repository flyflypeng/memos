# 16：NAS 构建、上线与人工验收

**要做什么：** 把全部改动交付到 NAS 上的线上服务：更新 CHANGELOG，把功能分支一次性推送到 `origin`；在 NAS 上拉取并构建镜像；经用户确认后切换线上容器的镜像；最后通过现有 HTTPS 域名完成人工验收。

**被阻塞于：** 05、08、11、12、15

**Status:** ready-for-agent

- [ ] CHANGELOG.md 与 CHANGELOG_zh.md 已更新；分支使用 `feat/` 前缀（不用 `claude/`、`chriscurry/`），推送到 `origin`，不打 tag
- [ ] NAS 上的源码目录与 memos 数据卷目录分开；`sudo docker build -t memos-local:<短提交哈希> .` 成功（sudo 密码由用户交互输入）
- [ ] 切换前备份 Compose 文件；用户明确确认后，才把线上服务改为新镜像并重建容器；数据库无需迁移
- [ ] 通过 HTTPS 验收：Chrome 安装 PWA、独立窗口、标题栏跟随主题、再次部署后出现刷新提示、API 和文件响应不来自 service worker 缓存
- [ ] Safari「添加到程序坞」的名称和图标正确；中文输入法在 macOS Chrome 和 Safari 中可用；手机上能输入并保存 Memo
- [ ] 在线上数据中抽查：旧 Memo 的表格、标签、嵌入、内嵌图片显示正确
- [ ] NAS 地址、端口、用户名和凭据都没有写进仓库

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
