# 13：可安装 PWA

**要做什么：** Memos 可以在 Chrome/Edge 中安装为独立窗口应用，也能用 Safari「添加到程序坞」，名称和图标正确。应用外壳被缓存，从 Dock 启动很快；API、资源文件和 RSS 始终走网络。部署新版本后出现「有新版本，点击刷新」提示，不会自动重新加载。标题栏颜色跟随浅色和深色主题。暂时使用现有图标。

**被阻塞于：** 无（可立即开始）

**Status:** resolved

- [ ] manifest 包含 `id`、`start_url`、`scope`、name/short_name「Memos」、description、`display: standalone`、background_color、theme_color，以及 192/512 的 any 和 maskable 图标；旧的静态 webmanifest 已删除
- [ ] service worker 预缓存应用外壳；`/api/`、`/memos.api.v1.`、`/file/`、RSS 以及服务端渲染路由只走网络；导航回退到缓存的 `index.html`
- [ ] 主题切换时同步 `theme-color`；已添加 `apple-mobile-web-app-title` 等 Safari meta 标签
- [ ] 检测到有新版本等待激活时显示刷新提示（四种语言），只有用户点击后才刷新
- [ ] 服务端对 service worker 文件和 manifest 返回 no-cache，带哈希的静态资源仍为 immutable
- [ ] 在开发机 localhost 上完成预检：Chrome DevTools 的 Application 面板显示可安装，且 API 响应不来自 service worker

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
