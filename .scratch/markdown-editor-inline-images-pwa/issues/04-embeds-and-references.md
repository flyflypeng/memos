# 04：嵌入 Memo、嵌入资源与引用

**要做什么：** 新渲染路径支持 `![[memos/uid]]` 嵌入 Memo（递归渲染，且防止自我或循环嵌入）、`![[resources/uid]]` 嵌入资源、`[[memos/uid]]` 引用 Memo。`![[resources/uid]]` 改为按 UID 解析资源，修复旧实现很可能一直显示「Resource not found」的问题。

**被阻塞于：** 02

**Status:** ready-for-agent

- [ ] 嵌入 Memo 正确显示内容，自我嵌入和循环嵌入不会无限递归
- [ ] `![[resources/uid]]` 能显示对应资源（修复前先复现旧问题，并记录在工单评论中）
- [ ] `[[memos/uid]]` 显示为引用，可以点击跳转
- [ ] S1 测试覆盖以上三种语法

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
