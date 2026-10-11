# 02：GFM 渲染器（并行路径）

**要做什么：** MemoContent 新增一条从 Memo 正文字符串渲染的路径，使用 unified/remark + GFM + math 解析，并按白名单做 HTML 消毒。旧的 nodes 渲染路径保留不动，调用方暂不切换（expand 阶段）。在测试和临时页面中，用户写的任意 GFM 表格、标准 Markdown、代码、Mermaid、公式和图片都能正确显示。

**被阻塞于：** 01

**Status:** ready-for-agent

- [ ] S1 表格样例全部正确渲染：`\|` 转义、行内代码中的 `|`、链接中的 `|`、无空格单元格、空单元格、列数不齐、无首尾管道、单元格内 `<br>`、对齐方式、中文全角符号、emoji
- [ ] 表格按 GFM 对齐，宽表格可横向滚动
- [ ] 允许 `details`/`summary`/`kbd`/`sub`/`sup`/`br`/`mark` 等 HTML；`script`、`on*` 属性、`javascript:` 链接被移除；```` ```__html ```` 保持现有不消毒行为
- [ ] 代码块高亮，```` ```mermaid ```` 渲染为图表，`$…$`/`$$…$$` 渲染为公式
- [ ] 图片按原比例显示，最大宽度为正文宽度，最大高度约 60vh，懒加载，点击放大；连续的纯图片段落仍合并成一组
- [ ] 折叠/展开（show more）与旧路径行为一致
- [ ] S1 渲染测试覆盖以上各项并通过

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
