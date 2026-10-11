# 05：渲染切换：所有调用方改为渲染 Memo 正文并移除 nodes

**要做什么：** 整站切换到新的渲染路径：时间线、Memo 详情、归档、回顾卡片、嵌入 Memo、导出模板全部从 Memo 正文渲染。勾选任务、「移除已完成任务」和「是否有已完成任务」都改为直接基于 Memo 正文实现。删除旧的 nodes 渲染路径、Memo 响应中的 `nodes` 字段，以及前端不再使用的 Markdown 服务 RPC（contract 阶段）。旧 Memo 的显示效果不变或更好。

**被阻塞于：** 03、04

**Status:** resolved

- [ ] 所有使用 MemoContent 的地方都改为传入 Memo 正文，代码中不再有 `memo.nodes` 的引用
- [ ] 勾选任务通过源码位置只修改该任务的 `[ ]`/`[x]`，其余文本逐字节不变；嵌套列表、引用块内、表格之后的任务都改对
- [ ] 「移除已完成任务」只删除已完成任务的行，其余文本不变
- [ ] Memo 响应不再包含 `nodes`，服务端不再按请求解析 Memo 正文；RestoreMarkdownNodes 等不再使用的 RPC 及其生成代码被删除；GetLinkMetadata（链接预览）保留
- [ ] 服务端 has-image 属性在 Memo 正文引用图片时为 true，并有 Go 测试；依赖 `nodes` 的 Go 测试已更新
- [ ] 旧的 nodes 渲染组件和死代码已删除；`go test ./...`、`pnpm test`、`pnpm lint --fix` 通过
- [ ] 在浏览器中检查：一批含表格、标签、嵌入、公式、Mermaid、任务的真实 Memo 显示正确

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
