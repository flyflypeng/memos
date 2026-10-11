# 08：表格辅助

**要做什么：** 在编辑器中可以快速创建和编辑 GFM 表格：从格式栏按行列数插入表格；Tab/Shift+Tab 在单元格之间移动；在末行按 Enter 新增一行；一键格式化，按列补齐对齐；在单元格内输入 `|` 自动转义为 `\|`。

**被阻塞于：** 07

**Status:** ready-for-agent

- [ ] 插入表格可以选择行数和列数，生成合法的 GFM 表格骨架
- [ ] Tab/Shift+Tab 在单元格间移动，末行按 Enter 新增一行
- [ ] 格式化后各列对齐，且表格内容不变（重新渲染结果相同）
- [ ] 单元格内输入 `|` 得到 `\|`，表格不会被破坏
- [ ] S2 测试覆盖以上命令

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
