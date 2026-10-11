# 01：测试基础设施与标签一致性样例

**要做什么：** 在 `web/` 中建立前端测试能力，并建立前后端共享的标签样例，作为 S1–S4 所有测试的基础。完成后，开发者在 `web/` 下运行 `pnpm test` 就能执行 vitest（jsdom + Testing Library）。仓库中有一份中立位置的 JSON 样例（Memo 正文 → 期望标签集合），Go 测试用现有 gomark 标签提取跑通它，为后续 remark 标签插件提供基准。

**被阻塞于：** 无（可立即开始）

**Status:** resolved

- [ ] `web/` 有 `test` 脚本，vitest + jsdom + @testing-library/react 可运行，并有一个真实的渲染断言示例
- [ ] 共享标签样例覆盖：普通标签、中文标签、嵌套路径标签、行尾和标点结尾、代码块和行内代码中的 `#`、URL 片段中的 `#`、`# 标题`、连续标签
- [ ] Go 测试读取该样例并对 gomark 提取结果做精确的集合比较，全部通过
- [ ] `go test ./...` 与 `pnpm test` 均通过

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
