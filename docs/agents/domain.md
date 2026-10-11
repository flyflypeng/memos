# 领域文档

说明各工程类 skill 在探索代码库时，应如何使用本仓库的领域文档。

## 探索前先读

- 仓库根目录的 **`GLOSSARY.md`**；或者
- 如果根目录存在 **`GLOSSARY-MAP.md`**，就读它。它会指向每个上下文各自的 `GLOSSARY.md`，按主题读取相关的那些。
- **`docs/adr/`**：读取与你即将改动的区域相关的 ADR。多上下文仓库中，还要查看 `src/<context>/docs/adr/` 里只适用于该上下文的决定。

这些文件不存在时，**直接继续，不必提示**：不要指出它们缺失，也不要建议预先创建。`/domain-modeling` skill（可通过 `/grill-with-docs` 和 `/improve-codebase-architecture` 进入）会在术语或决定真正确定时再创建它们。

## 文件结构

单上下文仓库（大多数仓库）：

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `GLOSSARY-MAP.md`）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 系统级决定
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 只适用于该上下文的决定
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## 使用术语表中的词汇

输出中提到领域概念时（issue 标题、重构提案、假设、测试名称），使用 `GLOSSARY.md` 中定义的术语，不要换成术语表明确列为「避免使用」的同义词。

如果需要的概念还不在术语表中，说明二者必居其一：要么你在发明项目并不使用的说法（应重新考虑），要么术语表确有缺口（记下来交给 `/domain-modeling`）。

## 指出与 ADR 的冲突

如果你的输出与现有 ADR 相矛盾，要明确指出，不要悄悄推翻：

> _与 ADR-0007（订单采用事件溯源）相矛盾，但值得重新讨论，因为……_
