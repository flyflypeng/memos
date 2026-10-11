# 06：CodeMirror 6 编辑器

**要做什么：** Memo 编辑器从 textarea 换成 CodeMirror 6 源码模式，提供 Markdown 语法高亮和代码块按语言高亮，保存的文本与输入完全一致。现有编辑行为全部保留，组件对外的命令式接口不变，标签选择、关联、位置、草稿缓存、禅模式等调用方都无需修改行为。

**被阻塞于：** 01

**Status:** resolved

- [ ] Markdown 语法高亮，代码块按语言高亮，浅色和深色主题与现有界面一致
- [ ] `#` 标签补全与 `@` Memo 补全（插入 `![[memos/uid]]`）照旧可用
- [ ] Cmd/Ctrl+B/I/K 可用，工作区关闭 Markdown 快捷键时失效；Enter 续写列表和任务，Tab 缩进；Cmd/Ctrl+Enter 保存，Cmd/Ctrl+Shift+Enter 切换禅模式
- [ ] 新建 Memo 的草稿缓存跨刷新保留；撤销和重做以完整操作为单位
- [ ] macOS Chrome 和 Safari 的中文输入法组字、选词、补全弹窗工作正常（人工验证，记录在工单评论中）
- [ ] S2 测试覆盖列表续写、快捷键包裹/切换、补全插入

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
