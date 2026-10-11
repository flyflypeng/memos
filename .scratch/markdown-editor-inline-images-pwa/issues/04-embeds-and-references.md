# 04：嵌入 Memo、嵌入资源与引用

**要做什么：** 新渲染路径支持 `![[memos/uid]]` 嵌入 Memo（递归渲染，且防止自我或循环嵌入）、`![[resources/uid]]` 嵌入资源、`[[memos/uid]]` 引用 Memo。`![[resources/uid]]` 改为按 UID 解析资源，修复旧实现很可能一直显示「Resource not found」的问题。

**被阻塞于：** 02

**Status:** ready-for-agent

- [ ] 嵌入 Memo 正确显示内容，自我嵌入和循环嵌入不会无限递归
- [ ] `![[resources/uid]]` 能显示对应资源（修复前先复现旧问题，并记录在工单评论中）
- [ ] `[[memos/uid]]` 显示为引用，可以点击跳转
- [ ] S1 测试覆盖以上三种语法

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。

## 评论

- 旧问题复现（修复前）：旧 `EmbeddedResource` 用 `getResourceByName(uid)` 按 `name`（`resources/{id}`）匹配 UID，而 `fetchResourceByUID` 把资源存在 `resource.name` 下，所以永远找不到。复现方式：（1）vitest 中 mock `getResourceByUid` 返回 `{name: "resources/7", uid: "abc123"}`，渲染旧组件后显示 `Resource not found: abc123`；（2）浏览器冒烟（dev 后端 18004）中，Memo 内容 `![[resources/BPXVdQP4ZQphh49REjViK9]]` 指向真实存在的资源，旧 nodes 路径显示 `Resource not found: BPXVdQP4ZQphh49REjViK9`。
- 新路径（`markdown/embeds/EmbeddedResource.tsx`）按 `r.uid === uid` 查找；冒烟中同一 Memo 显示出图片（`/file/resources/1/red.png`，HTTP 200）。`width=` 参数改用 inline style（旧的 `w-[${width}]` 是运行时拼出的 Tailwind 类，不会生成）。
